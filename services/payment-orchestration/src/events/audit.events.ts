import type { PaymentStatus } from '../domain/payment.js';

export type AuditRecord = {
  action: 'payment.internal_transfer.accepted' | 'payment.status.updated';
  paymentId: string;
  idempotencyKey?: string;
  fromStatus?: PaymentStatus;
  toStatus: PaymentStatus;
  eventId?: string;
  correlationId?: string;
  timestamp: string;
};

export class AuditEventsService {
  public readonly records: AuditRecord[] = [];

  async createPaymentAcceptedAuditRecord(
    paymentId: string,
    idempotencyKey: string,
    toStatus: PaymentStatus
  ): Promise<void> {
    this.records.push({
      action: 'payment.internal_transfer.accepted',
      paymentId,
      idempotencyKey,
      toStatus,
      timestamp: new Date().toISOString()
    });
  }

  async createPaymentStatusUpdatedAuditRecord(
    paymentId: string,
    fromStatus: PaymentStatus,
    toStatus: PaymentStatus,
    eventId?: string,
    correlationId?: string
  ): Promise<void> {
    this.records.push({
      action: 'payment.status.updated',
      paymentId,
      fromStatus,
      toStatus,
      eventId,
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
}
