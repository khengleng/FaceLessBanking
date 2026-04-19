export type EventSpecVersion = '1.0';

export type EventType =
  | 'customer.created.v1'
  | 'account.created.v1'
  | 'loan.created.v1'
  | 'payment.initiated.v1'
  | 'payment.status.updated.v1'
  | 'notification.requested.v1'
  | 'ekyc.status.updated.v1'
  | 'accounting.journal.posted.v1';

export type EventVersion = number;

export type EventMetadata = {
  eventId: string;
  correlationId: string;
  causationId?: string;
  timestamp: string;
  producer: string;
};

export type EventEnvelope<TType extends string, TPayload> = {
  specVersion: EventSpecVersion;
  type: TType;
  version: EventVersion;
  metadata: EventMetadata;
  payload: TPayload;
};

export type CustomerCreatedV1Payload = {
  customerId: string;
  status?: string;
};

export type AccountCreatedV1Payload = {
  accountId: string;
  customerId: string;
  productType?: string;
};

export type LoanCreatedV1Payload = {
  loanId: string;
  customerId: string;
  amount?: number;
};

export type PaymentInitiatedV1Payload = {
  paymentId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount?: number;
  currency?: string;
};

export type EkycStatusUpdatedV1Payload = {
  sessionId: string;
  customerId?: string;
  sumsubApplicantId?: string;
  provider?: string;
  oldStatus?: string;
  newStatus?: string;
  reviewResult?: string;
  status: string;
};

export type NotificationRequestedV1Payload = {
  notificationId: string;
  sourceEventId: string;
  paymentId: string;
  status: string;
  channel: string;
  templateKey: string;
  amount: number;
  currency: string;
  destinationAccountIdMasked: string;
};

export type PaymentStatusUpdatedV1Payload = {
  paymentId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  currency: string;
  previousStatus: string;
  status: string;
  reason: string;
};

export type CustomerCreatedV1Event = EventEnvelope<'customer.created.v1', CustomerCreatedV1Payload>;
export type AccountCreatedV1Event = EventEnvelope<'account.created.v1', AccountCreatedV1Payload>;
export type LoanCreatedV1Event = EventEnvelope<'loan.created.v1', LoanCreatedV1Payload>;
export type PaymentInitiatedV1Event = EventEnvelope<'payment.initiated.v1', PaymentInitiatedV1Payload>;
export type PaymentStatusUpdatedV1Event = EventEnvelope<'payment.status.updated.v1', PaymentStatusUpdatedV1Payload>;
export type NotificationRequestedV1Event = EventEnvelope<'notification.requested.v1', NotificationRequestedV1Payload>;
export type EkycStatusUpdatedV1Event = EventEnvelope<'ekyc.status.updated.v1', EkycStatusUpdatedV1Payload>;

export type CanonicalEvent =
  | CustomerCreatedV1Event
  | AccountCreatedV1Event
  | LoanCreatedV1Event
  | PaymentInitiatedV1Event
  | PaymentStatusUpdatedV1Event
  | NotificationRequestedV1Event
  | EkycStatusUpdatedV1Event;

export function buildEventEnvelope<TType extends string, TPayload>(input: {
  type: TType;
  metadata: EventMetadata;
  payload: TPayload;
  version?: EventVersion;
}): EventEnvelope<TType, TPayload> {
  return {
    specVersion: '1.0',
    type: input.type,
    version: input.version ?? 1,
    metadata: input.metadata,
    payload: input.payload
  };
}
