import { randomUUID } from 'node:crypto';
import type { PostgresAccountingAdapter } from '../adapters/postgres-accounting.adapter.js';
import type { AccountingEventsPublisher } from '../events/accounting.events.js';
import { 
  buildJournalEntry, 
  isJournalBalanced, 
  type JournalLine, 
  type JournalWithLines 
} from '../domain/journal.js';
import { 
  mapLoanDisbursementToJournal, 
  mapLoanInterestAccrualToJournal, 
  mapPaymentCompletedToJournal 
} from './journal-mapper.js';

export type CreateJournalResult =
  | { kind: 'created'; journal: JournalWithLines }
  | { kind: 'unbalanced' }
  | { kind: 'duplicate_event' }
  | { kind: 'invalid_event'; reason: string };

export type EventMetadata = {
  eventId: string;
  correlationId?: string;
};

export type PaymentStatusUpdatedEvent = {
  metadata: EventMetadata;
  payload: {
    paymentId: string;
    amount: number;
    currency: string;
    status: string;
  };
};

export type LoanDisbursementInitiatedEvent = {
  metadata: EventMetadata;
  payload: {
    loanAccountId: string;
    amount: number;
    currency: string;
  };
};

export type LoanInterestAccruedEvent = {
  metadata: EventMetadata;
  payload: {
    loanAccountId: string;
    accruedInterest: number;
    currency: string;
  };
};

export class AccountingApplication {
  constructor(
    private readonly postgresAdapter: PostgresAccountingAdapter,
    private readonly accountingEvents: AccountingEventsPublisher,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async createManualJournal(params: {
    description: string;
    lines: Array<{ accountCode: string; entryType: 'DEBIT' | 'CREDIT'; amount: number; currency: string }>;
  }): Promise<CreateJournalResult> {
    const journalId = randomUUID();
    const sourceEventId = `manual-${journalId}`;
    
    const lines: JournalLine[] = params.lines.map((l) => ({
      lineId: randomUUID(),
      journalId,
      ...l
    }));

    if (!isJournalBalanced(lines)) {
      return { kind: 'unbalanced' };
    }

    const entry = buildJournalEntry({
      journalId,
      sourceEventId,
      sourceEventType: 'manual.journal.v1',
      description: params.description,
      lines
    });

    await this.postgresAdapter.createJournalEntry(entry);
    await this.postgresAdapter.createJournalLines(lines);
    await this.accountingEvents.emitJournalPosted({ entry, lines });

    return { kind: 'created', journal: { entry, lines } };
  }

  async processPaymentCompleted(event: PaymentStatusUpdatedEvent): Promise<CreateJournalResult> {
    const { eventId, correlationId } = event.metadata;
    
    const processed = await this.postgresAdapter.hasProcessedAccountingEvent(eventId);
    if (processed) {
      this.logger.info({ eventId, correlationId }, 'Skipping duplicate payment completion event');
      return { kind: 'duplicate_event' };
    }

    if (event.payload.status !== 'COMPLETED') {
      return { kind: 'invalid_event', reason: 'payment_not_completed' };
    }

    const mapping = mapPaymentCompletedToJournal(event);
    
    const entry = buildJournalEntry({
      journalId: mapping.journalId,
      sourceEventId: eventId,
      sourceEventType: 'payment.status.updated.v1',
      description: mapping.description,
      lines: mapping.lines
    });

    await this.postgresAdapter.createJournalEntry(entry);
    await this.postgresAdapter.createJournalLines(mapping.lines);
    await this.postgresAdapter.markAccountingEventProcessed(eventId);
    await this.accountingEvents.emitJournalPosted({ entry, lines: mapping.lines }, correlationId);

    return { kind: 'created', journal: { entry, lines: mapping.lines } };
  }

  async processLoanDisbursement(event: LoanDisbursementInitiatedEvent): Promise<CreateJournalResult> {
    const { eventId, correlationId } = event.metadata;
    
    const processed = await this.postgresAdapter.hasProcessedAccountingEvent(eventId);
    if (processed) {
      return { kind: 'duplicate_event' };
    }

    const mapping = mapLoanDisbursementToJournal(event);
    
    const entry = buildJournalEntry({
      journalId: mapping.journalId,
      sourceEventId: eventId,
      sourceEventType: 'loan.disbursement.initiated.v1',
      description: mapping.description,
      lines: mapping.lines
    });

    await this.postgresAdapter.createJournalEntry(entry);
    await this.postgresAdapter.createJournalLines(mapping.lines);
    await this.postgresAdapter.markAccountingEventProcessed(eventId);
    await this.accountingEvents.emitJournalPosted({ entry, lines: mapping.lines }, correlationId);

    return { kind: 'created', journal: { entry, lines: mapping.lines } };
  }

  async processLoanInterestAccrual(event: LoanInterestAccruedEvent): Promise<CreateJournalResult> {
    const { eventId, correlationId } = event.metadata;
    
    const processed = await this.postgresAdapter.hasProcessedAccountingEvent(eventId);
    if (processed) {
      return { kind: 'duplicate_event' };
    }

    const mapping = mapLoanInterestAccrualToJournal(event);
    
    const entry = buildJournalEntry({
      journalId: mapping.journalId,
      sourceEventId: eventId,
      sourceEventType: 'loan.interest.accrued.v1',
      description: mapping.description,
      lines: mapping.lines
    });

    await this.postgresAdapter.createJournalEntry(entry);
    await this.postgresAdapter.createJournalLines(mapping.lines);
    await this.postgresAdapter.markAccountingEventProcessed(eventId);
    await this.accountingEvents.emitJournalPosted({ entry, lines: mapping.lines }, correlationId);

    return { kind: 'created', journal: { entry, lines: mapping.lines } };
  }

  async getJournalById(journalId: string): Promise<JournalWithLines | null> {
    const entry = await this.postgresAdapter.getJournalById(journalId);
    if (!entry) return null;
    
    const lines = await this.postgresAdapter.getJournalLines(journalId);
    return { entry, lines };
  }
}
