import { randomUUID } from 'node:crypto';

import type {
  CreateLoanRequestDto,
  CreateRepaymentRequestDto
} from '../controllers/dtos/loan.dto.js';
import { buildLoan, type Loan } from '../domain/loan.js';
import { buildRepayment, type Repayment } from '../domain/repayment.js';
import type { PostgresLoanAdapter } from '../adapters/postgres-loan.adapter.js';
import type { RedisIdempotencyAdapter } from '../adapters/redis-idempotency.adapter.js';
import type { PaymentAdapter } from '../adapters/payment.adapter.js';
import type { RulesEngineAdapter } from '../adapters/rules-engine.adapter.js';
import type { AuditEventsService } from '../events/audit.events.js';
import type { LoanEventsPublisher } from '../events/loan.events.js';

export type CreateLoanResult =
  | { kind: 'created'; loan: Loan }
  | { kind: 'invalid_payload'; errors: string[] }
  | { kind: 'idempotency_key_required' }
  | { kind: 'duplicate_idempotency'; referenceId: string }
  | { kind: 'rule_rejected'; reason: string };

export type GetLoanResult =
  | { kind: 'found'; loan: Loan }
  | { kind: 'not_found' };

export type InitiateRepaymentResult =
  | { kind: 'created'; repayment: Repayment }
  | { kind: 'invalid_payload'; errors: string[] }
  | { kind: 'idempotency_key_required' }
  | { kind: 'duplicate_idempotency'; referenceId: string }
  | { kind: 'loan_not_found' };

export class LoanApplication {
  constructor(
    private readonly postgresAdapter: PostgresLoanAdapter,
    private readonly redisAdapter: RedisIdempotencyAdapter,
    private readonly paymentAdapter: PaymentAdapter,
    private readonly rulesEngineAdapter: RulesEngineAdapter,
    private readonly auditEvents: AuditEventsService,
    private readonly loanEvents: LoanEventsPublisher,
    private readonly fundingAccountId: string
  ) {}

  async createLoan(
    payload: CreateLoanRequestDto,
    idempotencyKey: string | undefined
  ): Promise<CreateLoanResult> {
    if (!idempotencyKey) {
      return { kind: 'idempotency_key_required' };
    }

    const existingReference = await this.redisAdapter.getReferenceByKey(idempotencyKey);
    if (existingReference) {
      return { kind: 'duplicate_idempotency', referenceId: existingReference };
    }

    const errors = validateCreateLoanPayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    const eligibility = await this.rulesEngineAdapter.evaluateLoanEligibility({
      customerId: payload.customerId,
      productCode: payload.productCode,
      principalCents: payload.principalCents,
      currency: payload.currency,
      termMonths: payload.termMonths
    });

    if (!eligibility.eligible) {
      return { kind: 'rule_rejected', reason: eligibility.reason };
    }

    const loanId = randomUUID();
    const loan = buildLoan({
      loanId,
      customerId: payload.customerId,
      productCode: payload.productCode,
      principalCents: payload.principalCents,
      currency: payload.currency,
      termMonths: payload.termMonths,
      createdAt: new Date().toISOString(),
      externalLoanId: `loan-application-${loanId}`
    });

    await this.postgresAdapter.insertLoan(loan);
    await this.redisAdapter.saveKey(idempotencyKey, loan.loanId);
    await this.auditEvents.createLoanAuditRecord(loan.loanId, idempotencyKey);
    await this.loanEvents.emitLoanCreated(loan);

    return { kind: 'created', loan };
  }

  async getLoanById(loanId: string): Promise<GetLoanResult> {
    const loan = await this.postgresAdapter.findLoanById(loanId);

    if (!loan) {
      return { kind: 'not_found' };
    }

    return { kind: 'found', loan };
  }

  async initiateRepayment(
    loanAccountId: string,
    payload: CreateRepaymentRequestDto,
    idempotencyKey: string | undefined,
    correlationId: string
  ): Promise<InitiateRepaymentResult> {
    console.info(JSON.stringify({
      level: 'info',
      service: 'loan-orchestration',
      operation: 'loan.repayment.initiate',
      loanAccountId,
      correlationId
    }));

    if (!idempotencyKey) {
      return { kind: 'idempotency_key_required' };
    }

    const existingReference = await this.redisAdapter.getReferenceByKey(idempotencyKey);
    if (existingReference) {
      return { kind: 'duplicate_idempotency', referenceId: existingReference };
    }

    const loan = await this.postgresAdapter.getLoanAccountById(loanAccountId);
    if (!loan) {
      return { kind: 'loan_not_found' };
    }

    const errors = validateInitiateRepaymentPayload(payload, loan.currency);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    const payment = await this.paymentAdapter.initiateTransfer({
      sourceAccountId: payload.sourceAccountId,
      destinationAccountId: this.fundingAccountId,
      amountCents: payload.amountCents,
      currency: payload.currency,
      idempotencyKey,
      correlationId,
      channel: 'loan-repayment'
    });

    const repayment = buildRepayment({
      repaymentId: randomUUID(),
      loanAccountId,
      amountCents: payload.amountCents,
      currency: payload.currency,
      createdAt: new Date().toISOString(),
      paymentId: payment.paymentId
    });

    await this.postgresAdapter.createRepayment(repayment);
    await this.redisAdapter.saveKey(idempotencyKey, repayment.repaymentId);
    await this.loanEvents.emitRepaymentInitiated(repayment, correlationId);

    console.info(JSON.stringify({
      level: 'info',
      service: 'loan-orchestration',
      operation: 'loan.repayment.initiate',
      loanAccountId,
      repaymentId: repayment.repaymentId,
      paymentId: repayment.paymentId,
      correlationId
    }));

    return { kind: 'created', repayment };
  }
}

function validateCreateLoanPayload(payload: CreateLoanRequestDto): string[] {
  const errors: string[] = [];

  if (!payload.customerId || payload.customerId.trim().length < 3) {
    errors.push('customerId must contain at least 3 characters');
  }

  if (!payload.productCode || payload.productCode.trim().length < 2) {
    errors.push('productCode must contain at least 2 characters');
  }

  if (!payload.currency || payload.currency.trim().length !== 3) {
    errors.push('currency must be a 3-letter currency code');
  }

  if (payload.principalCents <= 0) {
    errors.push('principalCents must be greater than 0');
  }

  if (payload.termMonths <= 0) {
    errors.push('termMonths must be greater than 0');
  }

  return errors;
}

function validateInitiateRepaymentPayload(
  payload: CreateRepaymentRequestDto,
  expectedCurrency: string
): string[] {
  const errors: string[] = [];
  const REPAYMENT_PLACEHOLDER_LIMIT_CENTS = 5_000_000;

  if (payload.amountCents <= 0) {
    errors.push('amountCents must be greater than 0');
  }

  if (payload.amountCents > REPAYMENT_PLACEHOLDER_LIMIT_CENTS) {
    errors.push('amountCents exceeds placeholder repayment limit');
  }

  if (!payload.currency || payload.currency.trim().length !== 3) {
    errors.push('currency must be a 3-letter currency code');
  } else if (payload.currency !== expectedCurrency) {
    errors.push('currency must match loan currency');
  }

  if (!payload.sourceAccountId || payload.sourceAccountId.trim().length < 3) {
    errors.push('sourceAccountId must contain at least 3 characters');
  }

  return errors;
}
