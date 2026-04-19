import assert from 'node:assert/strict';
import test from 'node:test';

import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresNotificationAdapter } from '../adapters/postgres-notification.adapter.js';
import { PaymentNotificationTriggerApplication } from '../application/payment-notification-trigger.application.js';
import { NotificationTriggerMetrics } from '../events/metrics.js';
import { NotificationEventsPublisher } from '../events/notification.events.js';

function buildEvent(input: {
  eventId: string;
  status: string;
  amount?: number;
  correlationId?: string;
  destinationAccountId?: string;
}) {
  return {
    specVersion: '1.0',
    type: 'payment.status.updated.v1',
    version: 1,
    metadata: {
      eventId: input.eventId,
      correlationId: input.correlationId ?? 'corr-notification',
      timestamp: new Date().toISOString(),
      producer: 'payment-orchestration'
    },
    payload: {
      paymentId: 'payment-123',
      sourceAccountId: 'source-account-12345678',
      destinationAccountId: input.destinationAccountId ?? 'destination-account-87654321',
      amount: input.amount ?? 99.5,
      currency: 'USD',
      previousStatus: 'PROCESSING',
      status: input.status,
      reason: 'processed_successfully'
    }
  };
}

function buildHarness() {
  const postgresAdapter = new PostgresNotificationAdapter();
  const kafkaProducer = new KafkaProducerAdapter();
  const notificationEvents = new NotificationEventsPublisher(kafkaProducer);
  const metrics = new NotificationTriggerMetrics();

  const trigger = new PaymentNotificationTriggerApplication(
    postgresAdapter,
    notificationEvents,
    metrics,
    'push',
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
    }
  );

  return {
    trigger,
    postgresAdapter,
    kafkaProducer,
    metrics
  };
}

test('COMPLETED status creates notification request and emits notification.requested.v1', async () => {
  const harness = buildHarness();

  const result = await harness.trigger.processPaymentStatusUpdated(buildEvent({
    eventId: 'evt-completed-1',
    status: 'COMPLETED'
  }));

  assert.equal(result.kind, 'created');
  if (result.kind !== 'created') {
    return;
  }

  const saved = await harness.postgresAdapter.getNotificationById(result.notification.notificationId);
  assert.ok(saved);
  assert.equal(saved?.templateKey, 'payment.completed.v1');
  assert.equal(saved?.status, 'REQUESTED');

  assert.equal(harness.kafkaProducer.events.length, 1);
  assert.equal(harness.kafkaProducer.events[0]?.type, 'notification.requested.v1');
  assert.equal(harness.kafkaProducer.events[0]?.payload.status, 'COMPLETED');
  assert.equal(harness.metrics.notificationRequestsCreated, 1);
  assert.equal(harness.metrics.notificationEventsPublished, 1);
});

test('FAILED status creates notification request and emits notification.requested.v1', async () => {
  const harness = buildHarness();

  const result = await harness.trigger.processPaymentStatusUpdated(buildEvent({
    eventId: 'evt-failed-1',
    status: 'FAILED'
  }));

  assert.equal(result.kind, 'created');
  if (result.kind !== 'created') {
    return;
  }

  const saved = await harness.postgresAdapter.getNotificationById(result.notification.notificationId);
  assert.equal(saved?.templateKey, 'payment.failed.v1');

  assert.equal(harness.kafkaProducer.events.length, 1);
  assert.equal(harness.kafkaProducer.events[0]?.type, 'notification.requested.v1');
  assert.equal(harness.kafkaProducer.events[0]?.payload.status, 'FAILED');
});

test('ACCEPTED/PENDING/PROCESSING do not create notification requests', async () => {
  for (const status of ['ACCEPTED', 'PENDING', 'PROCESSING']) {
    const harness = buildHarness();

    const result = await harness.trigger.processPaymentStatusUpdated(buildEvent({
      eventId: `evt-ignored-${status}`,
      status
    }));

    assert.equal(result.kind, 'ignored_status');
    assert.equal(harness.kafkaProducer.events.length, 0);
  }
});

test('duplicate source event does not create duplicate notification', async () => {
  const harness = buildHarness();

  const event = buildEvent({
    eventId: 'evt-dup-1',
    status: 'COMPLETED'
  });

  const first = await harness.trigger.processPaymentStatusUpdated(event);
  assert.equal(first.kind, 'created');

  const second = await harness.trigger.processPaymentStatusUpdated(event);
  assert.equal(second.kind, 'duplicate');
  assert.equal(harness.kafkaProducer.events.length, 1);
  assert.equal(harness.metrics.duplicateNotificationsSkipped, 1);
});

test('malformed event is handled safely', async () => {
  const harness = buildHarness();

  const result = await harness.trigger.processPaymentStatusUpdated({
    specVersion: '1.0',
    type: 'payment.status.updated.v1',
    version: 1,
    metadata: {
      eventId: 'evt-bad',
      correlationId: 'corr-bad',
      timestamp: new Date().toISOString(),
      producer: 'payment-orchestration'
    },
    payload: {
      paymentId: 'payment-1',
      status: 'COMPLETED'
    }
  });

  assert.equal(result.kind, 'invalid_event');
  assert.equal(harness.kafkaProducer.events.length, 0);
});

test('notification payload does not include forbidden raw sensitive fields', async () => {
  const harness = buildHarness();
  const rawDestination = 'destination-account-1234567890';

  const result = await harness.trigger.processPaymentStatusUpdated(buildEvent({
    eventId: 'evt-safe-payload-1',
    status: 'COMPLETED',
    destinationAccountId: rawDestination
  }));

  assert.equal(result.kind, 'created');

  const payload = harness.kafkaProducer.events[0]?.payload as Record<string, unknown>;

  assert.ok(payload);
  assert.equal(payload.sourceAccountId, undefined);
  assert.equal(payload.destinationAccountId, undefined);
  assert.equal(payload.destinationAccountIdMasked === rawDestination, false);
  assert.equal(typeof payload.destinationAccountIdMasked, 'string');
  assert.equal(String(payload.destinationAccountIdMasked).startsWith('****'), true);
});
