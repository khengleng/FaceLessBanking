import {
  generateFixedInstallmentSchedule,
  type LoanRepaymentSchedule,
  type LoanRepaymentScheduleEntry
} from '../domain/repayment-schedule.js';
import { parseLoanScheduleTriggerEvent } from '../domain/loan-schedule-trigger-event.js';
import type { PostgresLoanAdapter } from '../adapters/postgres-loan.adapter.js';
import type { LoanEventsPublisher } from '../events/loan.events.js';
import type { LoanScheduleMetrics } from '../events/metrics.js';

export type GenerateLoanScheduleResult =
  | { kind: 'generated'; schedule: LoanRepaymentSchedule; entries: LoanRepaymentScheduleEntry[] }
  | { kind: 'duplicate_schedule'; scheduleId: string }
  | { kind: 'duplicate_event' }
  | { kind: 'loan_not_found' }
  | { kind: 'invalid_loan'; reason: string }
  | { kind: 'invalid_event'; reason: string };

export class LoanScheduleApplication {
  constructor(
    private readonly postgresAdapter: PostgresLoanAdapter,
    private readonly loanEvents: LoanEventsPublisher,
    private readonly metrics: LoanScheduleMetrics,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    },
    private readonly annualInterestRateBps: number
  ) {}

  async processLoanAccountCreated(rawEvent: unknown): Promise<GenerateLoanScheduleResult> {
    const event = parseLoanScheduleTriggerEvent(rawEvent);
    if (!event) {
      this.metrics.recordScheduleGenerationFailure();
      return { kind: 'invalid_event', reason: 'invalid_event_envelope' };
    }

    const eventId = event.metadata.eventId;
    const correlationId = event.metadata.correlationId;
    const loanAccountId = String(event.payload.loanAccountId ?? event.payload.loanId);

    const processed = await this.postgresAdapter.hasProcessedScheduleGenerationEvent(eventId);
    if (processed) {
      this.metrics.recordDuplicateScheduleGenerationSkipped();
      this.logger.info({ eventId, correlationId, loanAccountId }, 'Skipping duplicate schedule generation event');
      return { kind: 'duplicate_event' };
    }

    const result = await this.generateForLoanAccount(loanAccountId, correlationId);
    await this.postgresAdapter.markScheduleGenerationEventProcessed(eventId);

    return result;
  }

  async generateForLoanAccount(
    loanAccountId: string,
    correlationId: string
  ): Promise<GenerateLoanScheduleResult> {
    const existing = await this.postgresAdapter.getRepaymentScheduleByLoanAccountId(loanAccountId);
    if (existing) {
      this.metrics.recordDuplicateScheduleGenerationSkipped();
      this.logger.info({ loanAccountId, correlationId, scheduleId: existing.scheduleId }, 'Skipping schedule generation because schedule exists');
      return { kind: 'duplicate_schedule', scheduleId: existing.scheduleId };
    }

    const loan = await this.postgresAdapter.getLoanAccountById(loanAccountId);
    if (!loan) {
      this.metrics.recordScheduleGenerationFailure();
      return { kind: 'loan_not_found' };
    }

    if (loan.principalCents <= 0) {
      this.metrics.recordScheduleGenerationFailure();
      return { kind: 'invalid_loan', reason: 'principal_must_be_positive' };
    }

    if (!Number.isInteger(loan.termMonths) || loan.termMonths <= 0) {
      this.metrics.recordScheduleGenerationFailure();
      return { kind: 'invalid_loan', reason: 'term_months_must_be_positive_integer' };
    }

    const firstDueDate = deriveFirstDueDate(loan.createdAt);

    const generated = generateFixedInstallmentSchedule({
      loanAccountId,
      principalAmount: loan.principalCents,
      annualInterestRateBps: this.annualInterestRateBps,
      termMonths: loan.termMonths,
      firstDueDate,
      generatedAt: new Date().toISOString()
    });

    await this.postgresAdapter.createRepaymentSchedule(generated.schedule);
    await this.postgresAdapter.createRepaymentScheduleEntries(generated.entries);

    await this.loanEvents.emitLoanScheduleGenerated({
      loanAccountId,
      scheduleId: generated.schedule.scheduleId,
      numberOfInstallments: generated.entries.length,
      scheduleType: generated.schedule.scheduleType,
      correlationId
    });

    this.metrics.recordScheduleGenerated();
    this.logger.info(
      {
        correlationId,
        loanAccountId,
        scheduleId: generated.schedule.scheduleId,
        numberOfInstallments: generated.entries.length,
        annualInterestRateBps: this.annualInterestRateBps,
        roundingStrategy: 'cent_rounding_final_installment_reconcile'
      },
      'Generated fixed installment loan repayment schedule'
    );

    return {
      kind: 'generated',
      schedule: generated.schedule,
      entries: generated.entries
    };
  }
}

function deriveFirstDueDate(createdAt: string): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return new Date().toISOString();
  }

  const due = new Date(created.toISOString());
  due.setUTCMonth(due.getUTCMonth() + 1);
  return due.toISOString();
}
