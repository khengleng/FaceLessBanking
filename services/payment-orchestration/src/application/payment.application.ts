import { randomUUID } from 'node:crypto';

import type {
  CreateBeneficiaryRequestDto,
  InternalTransferRequestDto,
  ListPaymentsQueryDto
} from '../controllers/dtos/payment.dto.js';
import type { PostgresPaymentAdapter } from '../adapters/postgres-payment.adapter.js';
import type { RedisIdempotencyAdapter } from '../adapters/redis-idempotency.adapter.js';
import type { AuditEventsService } from '../events/audit.events.js';
import type { PaymentEventsPublisher } from '../events/payment.events.js';
import type { PaymentMetrics } from '../events/metrics.js';
import { buildPayment, isPaymentStatus, type Payment } from '../domain/payment.js';
import { buildBeneficiary, type Beneficiary } from '../domain/beneficiary.js';

export type InitiateTransferResult =
  | { kind: 'created'; payment: Payment; publishState: 'published' | 'publish_failed' }
  | { kind: 'duplicate_idempotency'; payment: Payment }
  | { kind: 'idempotency_key_required' };

export type GetPaymentResult =
  | { kind: 'found'; payment: Payment }
  | { kind: 'not_found' };

export type ListPaymentsResult =
  | { kind: 'listed'; payments: Payment[] }
  | { kind: 'invalid_query'; errors: string[] };

export type CreateBeneficiaryResult =
  | { kind: 'created'; beneficiary: Beneficiary }
  | { kind: 'invalid_payload'; errors: string[] };

export class PaymentApplication {
  constructor(
    private readonly postgresAdapter: PostgresPaymentAdapter,
    private readonly redisAdapter: RedisIdempotencyAdapter,
    private readonly auditEvents: AuditEventsService,
    private readonly paymentEvents: PaymentEventsPublisher,
    private readonly metrics: PaymentMetrics
  ) {}

  async initiateInternalTransfer(
    payload: InternalTransferRequestDto,
    idempotencyKey: string | undefined,
    correlationId: string
  ): Promise<InitiateTransferResult> {
    if (!idempotencyKey) {
      return { kind: 'idempotency_key_required' };
    }

    const existingRecord = await this.redisAdapter.getIdempotencyRecord(idempotencyKey);
    if (existingRecord) {
      this.metrics.recordIdempotencyHit();

      const existingPayment = await this.postgresAdapter.getPaymentById(existingRecord.paymentId)
        ?? await this.postgresAdapter.findPaymentByIdempotencyKey(idempotencyKey);

      if (existingPayment) {
        return { kind: 'duplicate_idempotency', payment: existingPayment };
      }
    }

    const now = new Date().toISOString();
    const paymentId = randomUUID();
    const payment = buildPayment({
      paymentId,
      idempotencyKey,
      sourceAccountId: payload.sourceAccountId,
      destinationAccountId: payload.destinationAccountId,
      amount: payload.amount,
      currency: payload.currency,
      channel: payload.channel,
      status: 'ACCEPTED',
      correlationId,
      createdAt: now,
      updatedAt: now
    });

    await this.postgresAdapter.createPayment(payment);
    await this.redisAdapter.setIdempotencyRecord(idempotencyKey, {
      paymentId: payment.paymentId,
      status: payment.status,
      correlationId
    });
    await this.auditEvents.createPaymentAcceptedAuditRecord(payment.paymentId, idempotencyKey, payment.status);

    const publishResult = await this.paymentEvents.emitPaymentInitiated(payment);
    if (!publishResult.published) {
      this.metrics.recordKafkaPublishFailure();

      await this.postgresAdapter.updatePaymentStatus(payment.paymentId, 'PENDING');
      await this.auditEvents.createPaymentStatusUpdatedAuditRecord(
        payment.paymentId,
        'ACCEPTED',
        'PENDING'
      );

      const updatedPayment = await this.postgresAdapter.getPaymentById(payment.paymentId) ?? {
        ...payment,
        status: 'PENDING' as const,
        updatedAt: new Date().toISOString()
      };

      return { kind: 'created', payment: updatedPayment, publishState: 'publish_failed' };
    }

    this.metrics.recordKafkaPublishSuccess();
    this.metrics.recordPaymentAccepted();

    return { kind: 'created', payment, publishState: 'published' };
  }

  async getPaymentById(paymentId: string): Promise<GetPaymentResult> {
    const payment = await this.postgresAdapter.getPaymentById(paymentId);
    this.metrics.recordDetailQuery();

    if (!payment) {
      return { kind: 'not_found' };
    }

    return { kind: 'found', payment };
  }

  async listPayments(query: ListPaymentsQueryDto): Promise<ListPaymentsResult> {
    const errors = validateListPaymentsQuery(query);
    if (errors.length > 0) {
      return { kind: 'invalid_query', errors };
    }

    if (query.status || query.accountId || query.correlationId) {
      this.metrics.recordFilteredQueryUsage();
    }
    this.metrics.recordListQuery();

    const payments = await this.postgresAdapter.listPayments({
      status: query.status,
      accountId: query.accountId,
      correlationId: query.correlationId,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0
    });

    return { kind: 'listed', payments };
  }

  async createBeneficiary(payload: CreateBeneficiaryRequestDto): Promise<CreateBeneficiaryResult> {
    const errors = validateBeneficiaryPayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    const beneficiary = buildBeneficiary({
      beneficiaryId: randomUUID(),
      customerId: payload.customerId,
      name: payload.name,
      accountId: payload.accountId,
      bankCode: payload.bankCode,
      createdAt: new Date().toISOString()
    });

    await this.postgresAdapter.insertBeneficiary(beneficiary);

    return { kind: 'created', beneficiary };
  }
}

function validateBeneficiaryPayload(payload: CreateBeneficiaryRequestDto): string[] {
  const errors: string[] = [];

  if (!payload.customerId || payload.customerId.trim().length < 3) {
    errors.push('customerId must contain at least 3 characters');
  }

  if (!payload.name || payload.name.trim().length < 2) {
    errors.push('name must contain at least 2 characters');
  }

  if (!payload.accountId || payload.accountId.trim().length < 3) {
    errors.push('accountId must contain at least 3 characters');
  }

  if (!payload.bankCode || payload.bankCode.trim().length < 2) {
    errors.push('bankCode must contain at least 2 characters');
  }

  return errors;
}

function validateListPaymentsQuery(query: ListPaymentsQueryDto): string[] {
  const errors: string[] = [];

  if (query.status !== undefined && !isPaymentStatus(query.status)) {
    errors.push('status must be one of ACCEPTED, PENDING, PROCESSING, COMPLETED, FAILED, REJECTED');
  }

  if (query.accountId !== undefined && query.accountId.trim().length < 2) {
    errors.push('accountId must contain at least 2 characters when provided');
  }

  if (query.correlationId !== undefined && query.correlationId.trim().length < 2) {
    errors.push('correlationId must contain at least 2 characters when provided');
  }

  if (query.limit !== undefined && (Number.isNaN(query.limit) || query.limit < 1 || query.limit > 200)) {
    errors.push('limit must be between 1 and 200');
  }

  if (query.offset !== undefined && (Number.isNaN(query.offset) || query.offset < 0)) {
    errors.push('offset must be 0 or greater');
  }

  return errors;
}
