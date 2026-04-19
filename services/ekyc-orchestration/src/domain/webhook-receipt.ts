export type WebhookReceipt = {
  receiptId: string;
  source: 'SUMSUB';
  dedupeKey: string;
  externalEventId?: string;
  eventType?: string;
  receivedAt: string;
  processedAt?: string;
  correlationId?: string;
};
