import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEventEnvelope,
  createEventBackboneConsumer,
  createEventBackboneProducer,
  InMemoryDeadLetterStore,
  processWithRetryAndDlq,
  TransientProcessingError,
  eventEnvelopeSchema,
  eventPayloadSchemas
} from '../index.js';
import type {
  EventBackboneTransport,
  CustomerCreatedV1Event
} from '../index.js';

test('buildEventEnvelope creates canonical envelope with default version', () => {
  const event = buildEventEnvelope({
    type: 'customer.created.v1',
    metadata: {
      eventId: 'evt_1',
      correlationId: 'corr_1',
      causationId: 'cmd_1',
      timestamp: new Date().toISOString(),
      producer: 'customer-service'
    },
    payload: {
      customerId: 'cust_1'
    }
  }) satisfies CustomerCreatedV1Event;

  assert.equal(event.specVersion, '1.0');
  assert.equal(event.version, 1);
  assert.equal(event.type, 'customer.created.v1');
  assert.equal(event.metadata.producer, 'customer-service');
});

test('schemas expose canonical envelope and required placeholder event schemas', () => {
  assert.equal(eventEnvelopeSchema.type, 'object');

  const expectedTypes = [
    'customer.created.v1',
    'account.created.v1',
    'loan.created.v1',
    'payment.initiated.v1',
    'notification.requested.v1',
    'ekyc.status.updated.v1'
  ];

  for (const eventType of expectedTypes) {
    assert.ok(eventPayloadSchemas[eventType as keyof typeof eventPayloadSchemas]);
  }
});

test('event backbone producer publishes canonical envelope', async () => {
  const producer = createEventBackboneProducer({
    producer: 'customer-service',
    retry: { maxAttempts: 2 },
    dlq: { topic: 'customer-service.dlq', enabled: true }
  });

  const published = await producer.publish({
    type: 'customer.created.v1',
    payload: { customerId: 'cust_1' },
    metadata: { correlationId: 'corr_1' }
  });

  assert.equal(published.published, true);
  assert.equal(producer.publishedEvents.length, 1);
  assert.equal(producer.publishedEvents[0]?.metadata.producer, 'customer-service');
  assert.equal(producer.publishedEvents[0]?.metadata.correlationId, 'corr_1');
});

test('event backbone producer retry works when transport is flaky', async () => {
  class FlakyTransport implements EventBackboneTransport {
    private attempts = 0;

    async send(): Promise<void> {
      this.attempts += 1;
      if (this.attempts < 2) {
        throw new Error('transient_failure');
      }
    }
  }

  const producer = createEventBackboneProducer(
    {
      producer: 'customer-service',
      retry: { maxAttempts: 3 },
      dlq: { topic: 'customer-service.dlq', enabled: true }
    },
    new FlakyTransport()
  );

  const published = await producer.publish({
    type: 'customer.created.v1',
    payload: { customerId: 'cust_retry' },
    metadata: { correlationId: 'corr_retry' }
  });

  assert.equal(published.published, true);
  assert.equal(published.attempts, 2);
  assert.equal(published.sentToDlq, false);
  assert.equal(producer.dlqEvents.length, 0);
});

test('event backbone producer moves failed events to DLQ after retry exhaustion', async () => {
  class AlwaysFailTransport implements EventBackboneTransport {
    async send(): Promise<void> {
      throw new Error('simulated_transport_failure');
    }
  }

  const failingProducer = createEventBackboneProducer(
    {
      producer: 'customer-service',
      retry: { maxAttempts: 3 },
      dlq: { topic: 'customer-service.dlq', enabled: true }
    },
    new AlwaysFailTransport()
  );

  const failed = await failingProducer.publish({
    type: 'customer.created.v1',
    payload: { customerId: 'cust_2' },
    metadata: { correlationId: 'corr_2' }
  });

  assert.equal(failed.published, false);
  assert.equal(failed.attempts, 3);
  assert.equal(failed.sentToDlq, true);
  assert.equal(failingProducer.dlqEvents.length, 1);
});

test('event backbone consumer placeholder stores subscriptions', async () => {
  const consumer = createEventBackboneConsumer({
    consumer: 'payment-orchestration-consumer',
    groupId: 'payment-orchestration-group',
    retry: { maxAttempts: 3 },
    dlq: { topic: 'payment-orchestration.dlq', enabled: true }
  });

  await consumer.subscribe(['payment.initiated.v1', 'loan.created.v1']);
  await consumer.start();

  assert.deepEqual(consumer.subscriptions, ['payment.initiated.v1', 'loan.created.v1']);
});

test('retry framework retries transient failure and succeeds', async () => {
  let attempts = 0;
  const dlqStore = new InMemoryDeadLetterStore();

  const result = await processWithRetryAndDlq({
    rawEvent: {
      metadata: { eventId: 'evt-retry-1' },
      payload: { paymentId: 'pay-1' }
    },
    sourceTopic: 'payment.initiated.v1',
    retryPolicy: { maxRetries: 2, baseDelayMs: 10, strategy: 'fixed' },
    deadLetterStore: dlqStore,
    parseEvent: (raw) => ({ ok: true, event: raw as Record<string, unknown> }),
    handler: async (_event, metadata) => {
      attempts += 1;
      assert.equal(metadata.maxRetries, 2);
      if (metadata.retryCount < 1) {
        throw new TransientProcessingError('temporary_failure');
      }
    }
  });

  assert.equal(result.kind, 'processed');
  assert.equal(result.attempts, 2);
  assert.equal(attempts, 2);
  assert.equal(dlqStore.records.length, 0);
});

test('retry framework sends event to DLQ when retries are exhausted', async () => {
  const dlqStore = new InMemoryDeadLetterStore();
  let attempts = 0;

  const result = await processWithRetryAndDlq({
    rawEvent: {
      metadata: { eventId: 'evt-retry-dlq-1' },
      payload: { paymentId: 'pay-2' }
    },
    sourceTopic: 'payment.initiated.v1',
    retryPolicy: { maxRetries: 2, baseDelayMs: 5, strategy: 'exponential' },
    deadLetterStore: dlqStore,
    parseEvent: (raw) => ({ ok: true, event: raw as Record<string, unknown> }),
    handler: async () => {
      attempts += 1;
      throw new TransientProcessingError('still_failing');
    }
  });

  assert.equal(result.kind, 'dead_lettered');
  assert.equal(result.reason, 'retry_exhausted');
  assert.equal(result.retryCount, 2);
  assert.equal(attempts, 3);
  assert.equal(dlqStore.records.length, 1);
  assert.equal(dlqStore.records[0]?.sourceEventId, 'evt-retry-dlq-1');
  assert.equal(dlqStore.records[0]?.sourceTopic, 'payment.initiated.v1');
});

test('retry framework routes malformed event to DLQ safely', async () => {
  const dlqStore = new InMemoryDeadLetterStore();

  const result = await processWithRetryAndDlq({
    rawEvent: {
      bad: true
    },
    sourceTopic: 'notification.requested.v1',
    retryPolicy: { maxRetries: 3, baseDelayMs: 0, strategy: 'fixed' },
    deadLetterStore: dlqStore,
    parseEvent: () => ({ ok: false, error: 'missing_envelope_metadata' }),
    handler: async () => {
      throw new Error('handler_should_not_run_for_malformed_event');
    }
  });

  assert.equal(result.kind, 'dead_lettered');
  assert.equal(result.reason, 'malformed_event');
  assert.equal(result.retryCount, 0);
  assert.equal(dlqStore.records.length, 1);
  assert.equal(dlqStore.records[0]?.sourceTopic, 'notification.requested.v1');
  assert.equal(dlqStore.records[0]?.errorMessage.startsWith('malformed_event:'), true);
});
