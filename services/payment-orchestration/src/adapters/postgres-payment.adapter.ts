import type { Beneficiary } from '../domain/beneficiary.js';
import type { Payment, PaymentStatus } from '../domain/payment.js';

export type PaymentStatusUpdateMetadata = {
  eventId: string;
  correlationId: string;
  stage: string;
};

export class PostgresPaymentAdapter {
  private readonly payments = new Map<string, Payment>();
  private readonly paymentByIdempotencyKey = new Map<string, string>();
  private readonly beneficiaries = new Map<string, Beneficiary>();
  private readonly processedConsumerEvents = new Set<string>();

  async createPayment(payment: Payment): Promise<void> {
    this.payments.set(payment.paymentId, payment);
    this.paymentByIdempotencyKey.set(payment.idempotencyKey, payment.paymentId);
  }

  async getPaymentById(paymentId: string): Promise<Payment | null> {
    return this.payments.get(paymentId) ?? null;
  }

  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    metadata?: PaymentStatusUpdateMetadata
  ): Promise<void> {
    const existing = this.payments.get(paymentId);
    if (!existing) {
      return;
    }

    void metadata;

    this.payments.set(paymentId, {
      ...existing,
      status,
      updatedAt: new Date().toISOString()
    });
  }

  async findPaymentByIdempotencyKey(idempotencyKey: string): Promise<Payment | null> {
    const paymentId = this.paymentByIdempotencyKey.get(idempotencyKey);
    if (!paymentId) {
      return null;
    }

    return this.getPaymentById(paymentId);
  }

  async listPayments(input: {
    status?: PaymentStatus;
    accountId?: string;
    correlationId?: string;
    limit: number;
    offset: number;
  }): Promise<Payment[]> {
    const payments = Array.from(this.payments.values())
      .filter((record) => (input.status ? record.status === input.status : true))
      .filter((record) => (input.accountId
        ? record.sourceAccountId === input.accountId || record.destinationAccountId === input.accountId
        : true))
      .filter((record) => (input.correlationId ? record.correlationId === input.correlationId : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return payments.slice(input.offset, input.offset + input.limit);
  }

  async hasProcessedConsumerEvent(eventId: string, stage: string): Promise<boolean> {
    return this.processedConsumerEvents.has(this.eventKey(eventId, stage));
  }

  async markConsumerEventProcessed(eventId: string, stage: string): Promise<void> {
    this.processedConsumerEvents.add(this.eventKey(eventId, stage));
  }

  async insertBeneficiary(beneficiary: Beneficiary): Promise<void> {
    this.beneficiaries.set(beneficiary.beneficiaryId, beneficiary);
  }

  private eventKey(eventId: string, stage: string): string {
    return `${stage}:${eventId}`;
  }
}
