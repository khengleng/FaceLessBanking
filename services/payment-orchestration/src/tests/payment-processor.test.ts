import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPaymentApplication } from '../application/build-payment.application.js';
import { PaymentProcessorApplication } from '../application/payment-processor.application.js';
import { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresPaymentAdapter } from '../adapters/postgres-payment.adapter.js';
import { RedisIdempotencyAdapter } from '../adapters/redis-idempotency.adapter.js';
import { AuditEventsService } from '../events/audit.events.js';
import { PaymentMetrics } from '../events/metrics.js';
import { PaymentProcessorConsumer } from '../events/payment-processor.consumer.js';
import { PaymentEventsPublisher } from '../events/payment.events.js';

function buildProcessorHarness(config?: { failPublish?: boolean }) {
  const postgresAdapter = new PostgresPaymentAdapter();
  const redisAdapter = new RedisIdempotencyAdapter();
  const kafkaProducer = new KafkaProducerAdapter({ failPublish: config?.failPublish ?? false });
  const paymentEvents = new PaymentEventsPublisher(kafkaProducer);
  const auditEvents = new AuditEventsService();
  const metrics = new PaymentMetrics();

  const application = buildPaymentApplication({
    postgresAdapter,
    redisAdapter,
    kafkaProducer,
    paymentEvents,
    auditEvents,
    metrics
  });

  const processor = new PaymentProcessorApplication(
    postgresAdapter,
    auditEvents,
    paymentEvents,
    metrics,
    {
      info: (payload: Record<string, unknown>, message: string): void => {
        void payload;
        void message;
      },
      warn: (payload: Record<string, unknown>, message: string): void => {
        void payload;
        void message;
      },
      error: (payload: Record<string, unknown>, message: string): void => {
        void payload;
        void message;
      }
    },
    {
      async runFraudChecks(): Promise<void> { return; },
      async postToCoreBanking(): Promise<void> { return; },
      async requestLedgerAnchor(): Promise<void> { return; },
      async triggerNotification(): Promise<void> { return; }
    }
  );

  return {
    postgresAdapter,
    redisAdapter,
    kafkaProducer,
    paymentEvents,
    auditEvents,
    metrics,
    application,
    processor
  };
}

function buildInitiatedEvent(input: {
  eventId: string;
  paymentId?: string;
  amount?: number;
  sourceAccountId?: string;
  destinationAccountId?: string;
  correlationId?: string;
}): Record<string, unknown> {
  return {
    specVersion: '1.0',
    type: 'payment.initiated.v1',
    version: 1,
    metadata: {
      eventId: input.eventId,
      correlationId: input.correlationId ?? 'corr-proc-1',
      timestamp: new Date().toISOString(),
      producer: 'payment-orchestration'
    },
    payload: {
      paymentId: input.paymentId ?? 'payment-1',
      sourceAccountId: input.sourceAccountId ?? 'acc-source-1',
      destinationAccountId: input.destinationAccountId ?? 'acc-dest-1',
      amount: input.amount ?? 100,
      currency: 'USD',
      channel: 'internal'
    }
  };
}

test('consume payment.initiated.v1 happy path', async () => {
  const harness = buildProcessorHarness();

  const created = await harness.application.initiateInternalTransfer(
    {
      sourceAccountId: 'acc-source-101',
      destinationAccountId: 'acc-dest-102',
      amount: 500,
      currency: 'USD',
      channel: 'internal'
    },
    'idem-processor-happy',
    'corr-processor-happy'
  );

  assert.equal(created.kind, 'created');
  if (created.kind !== 'created') {
    return;
  }

  const result = await harness.processor.processPaymentInitiated(buildInitiatedEvent({
    eventId: 'evt-processor-happy',
    paymentId: created.payment.paymentId,
    correlationId: 'corr-processor-happy'
  }));

  assert.equal(result.kind, 'processed');
  if (result.kind === 'processed') {
    assert.equal(result.finalStatus, 'COMPLETED');
  }

  const payment = await harness.postgresAdapter.getPaymentById(created.payment.paymentId);
  assert.equal(payment?.status, 'COMPLETED');
});

test('duplicate event does not process twice', async () => {
  const harness = buildProcessorHarness();

  const created = await harness.application.initiateInternalTransfer(
    {
      sourceAccountId: 'acc-source-201',
      destinationAccountId: 'acc-dest-202',
      amount: 900,
      currency: 'USD',
      channel: 'internal'
    },
    'idem-processor-dup',
    'corr-processor-dup'
  );

  assert.equal(created.kind, 'created');
  if (created.kind !== 'created') {
    return;
  }

  const event = buildInitiatedEvent({
    eventId: 'evt-processor-dup',
    paymentId: created.payment.paymentId,
    correlationId: 'corr-processor-dup'
  });

  const first = await harness.processor.processPaymentInitiated(event);
  assert.equal(first.kind, 'processed');

  const second = await harness.processor.processPaymentInitiated(event);
  assert.equal(second.kind, 'duplicate_event');
  assert.equal(harness.metrics.duplicateConsumerEventsSkipped, 1);
});

test('missing paymentId is handled safely', async () => {
  const harness = buildProcessorHarness();

  const result = await harness.processor.processPaymentInitiated(buildInitiatedEvent({
    eventId: 'evt-payment-missing',
    paymentId: 'payment-does-not-exist'
  }));

  assert.equal(result.kind, 'payment_not_found');
});

test('invalid payload/event envelope is rejected safely', async () => {
  const harness = buildProcessorHarness();

  const result = await harness.processor.processPaymentInitiated({
    specVersion: '1.0',
    type: 'payment.initiated.v1',
    version: 1,
    metadata: {
      eventId: 'evt-invalid',
      correlationId: 'corr-invalid',
      timestamp: new Date().toISOString(),
      producer: 'payment-orchestration'
    },
    payload: {
      paymentId: 'payment-1',
      sourceAccountId: 'acc-source',
      destinationAccountId: 'acc-dest',
      amount: 'invalid',
      currency: 'USD',
      channel: 'internal'
    }
  });

  assert.equal(result.kind, 'invalid_event');
});

test('processing transitions to COMPLETED on success', async () => {
  const harness = buildProcessorHarness();

  const created = await harness.application.initiateInternalTransfer(
    {
      sourceAccountId: 'acc-source-301',
      destinationAccountId: 'acc-dest-302',
      amount: 1200,
      currency: 'USD',
      channel: 'internal'
    },
    'idem-processor-completed',
    'corr-processor-completed'
  );

  assert.equal(created.kind, 'created');
  if (created.kind !== 'created') {
    return;
  }

  const result = await harness.processor.processPaymentInitiated(buildInitiatedEvent({
    eventId: 'evt-processor-completed',
    paymentId: created.payment.paymentId
  }));

  assert.equal(result.kind, 'processed');
  if (result.kind === 'processed') {
    assert.equal(result.finalStatus, 'COMPLETED');
  }
  assert.equal(harness.metrics.paymentsProcessingStarted, 1);
  assert.equal(harness.metrics.paymentsCompleted, 1);
});

test('processing transitions to FAILED on placeholder failure', async () => {
  const harness = buildProcessorHarness();

  const created = await harness.application.initiateInternalTransfer(
    {
      sourceAccountId: 'acc-source-401',
      destinationAccountId: 'acc-dest-402',
      amount: 2200,
      currency: 'USD',
      channel: 'internal'
    },
    'idem-processor-failed',
    'corr-processor-failed'
  );

  assert.equal(created.kind, 'created');
  if (created.kind !== 'created') {
    return;
  }

  const result = await harness.processor.processPaymentInitiated(buildInitiatedEvent({
    eventId: 'evt-processor-failed',
    paymentId: created.payment.paymentId,
    amount: 0
  }));

  assert.equal(result.kind, 'processed');
  if (result.kind === 'processed') {
    assert.equal(result.finalStatus, 'FAILED');
  }

  const payment = await harness.postgresAdapter.getPaymentById(created.payment.paymentId);
  assert.equal(payment?.status, 'FAILED');
  assert.equal(harness.metrics.paymentsFailed, 1);
});

test('payment.status.updated.v1 is emitted', async () => {
  const harness = buildProcessorHarness();

  const created = await harness.application.initiateInternalTransfer(
    {
      sourceAccountId: 'acc-source-501',
      destinationAccountId: 'acc-dest-502',
      amount: 1300,
      currency: 'USD',
      channel: 'internal'
    },
    'idem-status-updated',
    'corr-status-updated'
  );

  assert.equal(created.kind, 'created');
  if (created.kind !== 'created') {
    return;
  }

  await harness.processor.processPaymentInitiated(buildInitiatedEvent({
    eventId: 'evt-status-updated',
    paymentId: created.payment.paymentId
  }));

  const statusEvents = harness.kafkaProducer.events.filter((event) => event.type === 'payment.status.updated.v1');
  assert.equal(statusEvents.length, 2);
  assert.equal(statusEvents[0]?.payload.status, 'PROCESSING');
  assert.equal(statusEvents[1]?.payload.status, 'COMPLETED');
});

test('invalid state transition is prevented', async () => {
  const harness = buildProcessorHarness();

  const created = await harness.application.initiateInternalTransfer(
    {
      sourceAccountId: 'acc-source-601',
      destinationAccountId: 'acc-dest-602',
      amount: 1400,
      currency: 'USD',
      channel: 'internal'
    },
    'idem-invalid-transition',
    'corr-invalid-transition'
  );

  assert.equal(created.kind, 'created');
  if (created.kind !== 'created') {
    return;
  }

  await harness.postgresAdapter.updatePaymentStatus(created.payment.paymentId, 'REJECTED', {
    eventId: 'evt-manual-reject',
    correlationId: 'corr-manual-reject',
    stage: 'manual'
  });

  const result = await harness.processor.processPaymentInitiated(buildInitiatedEvent({
    eventId: 'evt-invalid-transition',
    paymentId: created.payment.paymentId
  }));

  assert.equal(result.kind, 'invalid_transition');
  if (result.kind === 'invalid_transition') {
    assert.equal(result.currentStatus, 'REJECTED');
  }
});

test('consumer adapter can wire and invoke payment initiated handler', async () => {
  const harness = buildProcessorHarness();
  const consumerAdapter = new KafkaConsumerAdapter();
  const consumer = new PaymentProcessorConsumer(consumerAdapter, harness.processor);

  const created = await harness.application.initiateInternalTransfer(
    {
      sourceAccountId: 'acc-source-701',
      destinationAccountId: 'acc-dest-702',
      amount: 1700,
      currency: 'USD',
      channel: 'internal'
    },
    'idem-consumer-wire',
    'corr-consumer-wire'
  );

  assert.equal(created.kind, 'created');
  if (created.kind !== 'created') {
    return;
  }

  await consumer.subscribe();
  await consumerAdapter.handlePaymentInitiated(buildInitiatedEvent({
    eventId: 'evt-consumer-wire',
    paymentId: created.payment.paymentId
  }));

  const payment = await harness.postgresAdapter.getPaymentById(created.payment.paymentId);
  assert.equal(payment?.status, 'COMPLETED');
});
