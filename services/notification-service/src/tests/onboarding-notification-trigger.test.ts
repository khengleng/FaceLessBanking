import assert from 'node:assert/strict';
import test from 'node:test';

import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresNotificationAdapter } from '../adapters/postgres-notification.adapter.js';
import { OnboardingNotificationTriggerApplication } from '../application/onboarding-notification-trigger.application.js';
import { NotificationTriggerMetrics } from '../events/metrics.js';
import { NotificationEventsPublisher } from '../events/notification.events.js';

function buildHarness() {
  const postgresAdapter = new PostgresNotificationAdapter();
  const kafkaProducer = new KafkaProducerAdapter();
  const notificationEvents = new NotificationEventsPublisher(kafkaProducer);
  const metrics = new NotificationTriggerMetrics();

  const trigger = new OnboardingNotificationTriggerApplication(
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

function buildEkycEvent(input: {
  eventId: string;
  status: string;
  sessionId?: string;
  customerId?: string;
}) {
  return {
    specVersion: '1.0',
    type: 'ekyc.status.updated.v1',
    version: 1,
    metadata: {
      eventId: input.eventId,
      correlationId: 'corr-onboarding-notification-1',
      timestamp: new Date().toISOString(),
      producer: 'ekyc-orchestration'
    },
    payload: {
      sessionId: input.sessionId ?? 'ekyc-session-1',
      customerId: input.customerId,
      provider: 'SUMSUB',
      status: input.status,
      newStatus: input.status,
      reviewResult: 'AUTO_REVIEW'
    }
  };
}

function buildCaseActionEvent(input: {
  eventId: string;
  newStatus: string;
  caseId?: string;
}) {
  return {
    specVersion: '1.0',
    type: 'case.action.recorded.v1',
    version: 1,
    metadata: {
      eventId: input.eventId,
      correlationId: 'corr-onboarding-notification-2',
      timestamp: new Date().toISOString(),
      producer: 'workflow-case-management'
    },
    payload: {
      caseId: input.caseId ?? 'onboarding-case-1',
      actionId: 'action-1',
      actionType: input.newStatus === 'APPROVED' ? 'APPROVE' : 'REJECT',
      newStatus: input.newStatus,
      reason: 'MANUAL_REVIEW'
    }
  };
}

test('APPROVED onboarding-related event creates notification request and emits notification.requested.v1', async () => {
  const harness = buildHarness();

  const result = await harness.trigger.processCaseActionRecorded(buildCaseActionEvent({
    eventId: 'evt-onboarding-approved-1',
    newStatus: 'APPROVED'
  }));

  assert.equal(result.kind, 'created');
  if (result.kind !== 'created') {
    return;
  }

  const saved = await harness.postgresAdapter.getNotificationById(result.notification.notificationId);
  assert.ok(saved);
  assert.equal(saved?.templateKey, 'onboarding.case.approved.v1');
  assert.equal(saved?.status, 'REQUESTED');

  assert.equal(harness.kafkaProducer.events.length, 1);
  assert.equal(harness.kafkaProducer.events[0]?.type, 'notification.requested.v1');
  assert.equal(harness.metrics.onboardingNotificationsCreated, 1);
  assert.equal(harness.metrics.onboardingNotificationEventsPublished, 1);
});

test('REJECTED onboarding-related event creates notification request and emits notification.requested.v1', async () => {
  const harness = buildHarness();

  const result = await harness.trigger.processCaseActionRecorded(buildCaseActionEvent({
    eventId: 'evt-onboarding-rejected-1',
    newStatus: 'REJECTED'
  }));

  assert.equal(result.kind, 'created');
  if (result.kind !== 'created') {
    return;
  }

  const saved = await harness.postgresAdapter.getNotificationById(result.notification.notificationId);
  assert.ok(saved);
  assert.equal(saved?.templateKey, 'onboarding.case.rejected.v1');

  assert.equal(harness.kafkaProducer.events.length, 1);
  assert.equal(harness.kafkaProducer.events[0]?.type, 'notification.requested.v1');
});

test('ON_HOLD ekyc event creates notification request and emits notification.requested.v1', async () => {
  const harness = buildHarness();

  const result = await harness.trigger.processEkycStatusUpdated(buildEkycEvent({
    eventId: 'evt-ekyc-hold-1',
    status: 'ON_HOLD'
  }));

  assert.equal(result.kind, 'created');
  if (result.kind !== 'created') {
    return;
  }

  const saved = await harness.postgresAdapter.getNotificationById(result.notification.notificationId);
  assert.ok(saved);
  assert.equal(saved?.templateKey, 'onboarding.ekyc.on_hold.v1');

  assert.equal(harness.kafkaProducer.events.length, 1);
  assert.equal(harness.kafkaProducer.events[0]?.type, 'notification.requested.v1');
});

test('non-notifiable intermediate statuses do not create notification requests', async () => {
  const harness = buildHarness();

  const intermediateStatuses = ['INITIATED', 'PENDING_REVIEW', 'IN_REVIEW'];
  for (const status of intermediateStatuses) {
    const result = await harness.trigger.processEkycStatusUpdated(buildEkycEvent({
      eventId: `evt-ekyc-${status}`,
      status
    }));

    assert.equal(result.kind, 'ignored_status');
  }

  assert.equal(harness.kafkaProducer.events.length, 0);
  assert.equal(harness.metrics.onboardingNotificationsCreated, 0);
});

test('duplicate source event does not create duplicate notification', async () => {
  const harness = buildHarness();

  const event = buildEkycEvent({
    eventId: 'evt-ekyc-duplicate-1',
    status: 'APPROVED'
  });

  const first = await harness.trigger.processEkycStatusUpdated(event);
  assert.equal(first.kind, 'created');

  const second = await harness.trigger.processEkycStatusUpdated(event);
  assert.equal(second.kind, 'duplicate');
  assert.equal(harness.kafkaProducer.events.length, 1);
  assert.equal(harness.metrics.duplicateOnboardingNotificationsSkipped, 1);
});

test('malformed event is handled safely', async () => {
  const harness = buildHarness();

  const result = await harness.trigger.processCaseActionRecorded({
    specVersion: '1.0',
    type: 'case.action.recorded.v1',
    version: 1,
    metadata: {
      eventId: 'evt-bad-1',
      correlationId: 'corr-bad-1',
      timestamp: new Date().toISOString(),
      producer: 'workflow-case-management'
    },
    payload: {
      caseId: 'case-1'
    }
  });

  assert.equal(result.kind, 'invalid_event');
  assert.equal(harness.kafkaProducer.events.length, 0);
});
