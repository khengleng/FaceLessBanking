import type { EventType } from './types.js';

export type JsonSchema = {
  $id?: string;
  $schema?: string;
  title?: string;
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: string[];
  items?: JsonSchema;
  additionalProperties?: boolean;
};

export const eventEnvelopeSchema: JsonSchema = {
  $id: 'faceless-banking.event-envelope.v1',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'CanonicalEventEnvelope',
  type: 'object',
  additionalProperties: false,
  required: ['specVersion', 'type', 'version', 'metadata', 'payload'],
  properties: {
    specVersion: {
      type: 'string',
      enum: ['1.0']
    },
    type: {
      type: 'string'
    },
    version: {
      type: 'number'
    },
    metadata: {
      type: 'object',
      additionalProperties: false,
      required: ['eventId', 'correlationId', 'timestamp', 'producer'],
      properties: {
        eventId: { type: 'string' },
        correlationId: { type: 'string' },
        causationId: { type: 'string' },
        timestamp: { type: 'string' },
        producer: { type: 'string' }
      }
    },
    payload: {
      type: 'object'
    }
  }
};

export const eventPayloadSchemas: Record<EventType, JsonSchema> = {
  'customer.created.v1': {
    $id: 'faceless-banking.customer.created.v1',
    type: 'object',
    additionalProperties: false,
    required: ['customerId'],
    properties: {
      customerId: { type: 'string' },
      status: { type: 'string' }
    }
  },
  'account.created.v1': {
    $id: 'faceless-banking.account.created.v1',
    type: 'object',
    additionalProperties: false,
    required: ['accountId', 'customerId'],
    properties: {
      accountId: { type: 'string' },
      customerId: { type: 'string' },
      productType: { type: 'string' }
    }
  },
  'loan.created.v1': {
    $id: 'faceless-banking.loan.created.v1',
    type: 'object',
    additionalProperties: false,
    required: ['loanId', 'customerId'],
    properties: {
      loanId: { type: 'string' },
      customerId: { type: 'string' },
      amount: { type: 'number' }
    }
  },
  'payment.initiated.v1': {
    $id: 'faceless-banking.payment.initiated.v1',
    type: 'object',
    additionalProperties: false,
    required: ['paymentId', 'sourceAccountId', 'destinationAccountId'],
    properties: {
      paymentId: { type: 'string' },
      sourceAccountId: { type: 'string' },
      destinationAccountId: { type: 'string' },
      amount: { type: 'number' },
      currency: { type: 'string' }
    }
  },
  'payment.status.updated.v1': {
    $id: 'faceless-banking.payment.status.updated.v1',
    type: 'object',
    additionalProperties: false,
    required: [
      'paymentId',
      'status',
      'sourceAccountId',
      'destinationAccountId',
      'amount',
      'currency'
    ],
    properties: {
      paymentId: { type: 'string' },
      status: { type: 'string' },
      sourceAccountId: { type: 'string' },
      destinationAccountId: { type: 'string' },
      amount: { type: 'number' },
      currency: { type: 'string' },
      reason: { type: 'string' }
    }
  },
  'notification.requested.v1': {
    $id: 'faceless-banking.notification.requested.v1',
    type: 'object',
    additionalProperties: false,
    required: [
      'notificationId',
      'sourceEventId',
      'paymentId',
      'status',
      'channel',
      'templateKey',
      'amount',
      'currency',
      'destinationAccountIdMasked'
    ],
    properties: {
      notificationId: { type: 'string' },
      sourceEventId: { type: 'string' },
      paymentId: { type: 'string' },
      status: { type: 'string' },
      channel: { type: 'string' },
      templateKey: { type: 'string' },
      amount: { type: 'number' },
      currency: { type: 'string' },
      destinationAccountIdMasked: { type: 'string' }
    }
  },
  'ekyc.status.updated.v1': {
    $id: 'faceless-banking.ekyc.status.updated.v1',
    type: 'object',
    additionalProperties: false,
    required: ['sessionId', 'status'],
    properties: {
      sessionId: { type: 'string' },
      customerId: { type: 'string' },
      sumsubApplicantId: { type: 'string' },
      provider: { type: 'string' },
      oldStatus: { type: 'string' },
      newStatus: { type: 'string' },
      reviewResult: { type: 'string' },
      status: { type: 'string' }
    }
  },
  'accounting.journal.posted.v1': {
    $id: 'faceless-banking.accounting.journal.posted.v1',
    type: 'object',
    additionalProperties: false,
    required: [
      'journalId',
      'sourceEventId',
      'sourceEventType',
      'totalDebit',
      'totalCredit'
    ],
    properties: {
      journalId: { type: 'string' },
      sourceEventId: { type: 'string' },
      sourceEventType: { type: 'string' },
      totalDebit: { type: 'string' },
      totalCredit: { type: 'string' }
    }
  }
};
