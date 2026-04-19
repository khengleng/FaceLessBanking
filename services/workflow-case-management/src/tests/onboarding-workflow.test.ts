import assert from 'node:assert/strict';
import test from 'node:test';

import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresCaseAdapter } from '../adapters/postgres-case.adapter.js';
import { OnboardingWorkflowApplication } from '../application/onboarding-workflow.application.js';
import { CaseEventsPublisher } from '../events/case.events.js';
import { OnboardingWorkflowMetrics } from '../events/metrics.js';

function buildHarness() {
  const postgresAdapter = new PostgresCaseAdapter();
  const kafkaProducer = new KafkaProducerAdapter();
  const eventsPublisher = new CaseEventsPublisher(kafkaProducer);
  const metrics = new OnboardingWorkflowMetrics();

  const application = new OnboardingWorkflowApplication(
    postgresAdapter,
    eventsPublisher,
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
    }
  );

  return {
    application,
    postgresAdapter,
    kafkaProducer,
    metrics
  };
}

function buildEkycEvent(input: {
  eventId: string;
  correlationId?: string;
  customerId?: string;
  sessionId?: string;
  newStatus: string;
  oldStatus?: string;
  reviewResult?: string;
}) {
  return {
    specVersion: '1.0',
    type: 'ekyc.status.updated.v1',
    version: 1,
    metadata: {
      eventId: input.eventId,
      correlationId: input.correlationId ?? 'corr-onboarding-1',
      timestamp: new Date().toISOString(),
      producer: 'ekyc-orchestration'
    },
    payload: {
      sessionId: input.sessionId ?? 'ekyc-session-1',
      customerId: input.customerId,
      status: input.newStatus,
      newStatus: input.newStatus,
      oldStatus: input.oldStatus,
      reviewResult: input.reviewResult
    }
  };
}

test('APPROVED ekyc event creates or updates case to APPROVED', async () => {
  const harness = buildHarness();

  const result = await harness.application.processEkycStatusUpdated(
    buildEkycEvent({
      eventId: 'evt-approved-1',
      customerId: 'cust-100',
      newStatus: 'APPROVED'
    })
  );

  assert.equal(result.kind, 'created');
  assert.equal(result.caseRecord.status, 'APPROVED');

  const found = await harness.postgresAdapter.getCaseByEntity('CUSTOMER_ONBOARDING', 'cust-100');
  assert.equal(found?.status, 'APPROVED');
});

test('REJECTED ekyc event creates or updates case to REJECTED', async () => {
  const harness = buildHarness();

  const result = await harness.application.processEkycStatusUpdated(
    buildEkycEvent({
      eventId: 'evt-rejected-1',
      customerId: 'cust-200',
      newStatus: 'REJECTED'
    })
  );

  assert.equal(result.kind, 'created');
  assert.equal(result.caseRecord.status, 'REJECTED');
});

test('ON_HOLD ekyc event creates or updates case to ON_HOLD', async () => {
  const harness = buildHarness();

  const result = await harness.application.processEkycStatusUpdated(
    buildEkycEvent({
      eventId: 'evt-hold-1',
      customerId: 'cust-300',
      newStatus: 'ON_HOLD',
      reviewResult: 'RETRY'
    })
  );

  assert.equal(result.kind, 'created');
  assert.equal(result.caseRecord.status, 'ON_HOLD');
});

test('PENDING_REVIEW ekyc event creates or updates case to IN_REVIEW', async () => {
  const harness = buildHarness();

  const result = await harness.application.processEkycStatusUpdated(
    buildEkycEvent({
      eventId: 'evt-pending-1',
      sessionId: 'ekyc-session-444',
      newStatus: 'PENDING_REVIEW'
    })
  );

  assert.equal(result.kind, 'created');
  assert.equal(result.caseRecord.status, 'IN_REVIEW');

  const found = await harness.postgresAdapter.getCaseByEntity('EKYC_SESSION', 'ekyc-session-444');
  assert.equal(found?.status, 'IN_REVIEW');
});

test('duplicate sourceEventId does not process twice', async () => {
  const harness = buildHarness();

  const event = buildEkycEvent({
    eventId: 'evt-dup-1',
    customerId: 'cust-500',
    newStatus: 'APPROVED'
  });

  const first = await harness.application.processEkycStatusUpdated(event);
  assert.equal(first.kind, 'created');

  const second = await harness.application.processEkycStatusUpdated(event);
  assert.equal(second.kind, 'duplicate');
  assert.equal(harness.metrics.duplicateWorkflowEventsSkipped, 1);
});

test('invalid transition is blocked safely', async () => {
  const harness = buildHarness();

  const first = await harness.application.processEkycStatusUpdated(
    buildEkycEvent({
      eventId: 'evt-transition-1',
      customerId: 'cust-600',
      newStatus: 'APPROVED'
    })
  );
  assert.equal(first.kind, 'created');

  const second = await harness.application.processEkycStatusUpdated(
    buildEkycEvent({
      eventId: 'evt-transition-2',
      customerId: 'cust-600',
      newStatus: 'PENDING_REVIEW'
    })
  );

  assert.equal(second.kind, 'invalid_transition');
  assert.equal(harness.metrics.invalidTransitionsBlocked, 1);

  const found = await harness.postgresAdapter.getCaseByEntity('CUSTOMER_ONBOARDING', 'cust-600');
  assert.equal(found?.status, 'APPROVED');
});

test('case.created.v1 emitted on new case creation', async () => {
  const harness = buildHarness();

  const result = await harness.application.processEkycStatusUpdated(
    buildEkycEvent({
      eventId: 'evt-created-emit-1',
      customerId: 'cust-700',
      newStatus: 'PENDING_REVIEW'
    })
  );

  assert.ok(result.kind === 'created' || result.kind === 'transitioned');
  const createdEvent = harness.kafkaProducer.events.find((event) => event.eventName === 'case.created.v1');
  assert.ok(createdEvent);
});

test('case.action.recorded.v1 emitted on status change', async () => {
  const harness = buildHarness();

  const first = await harness.application.processEkycStatusUpdated(
    buildEkycEvent({
      eventId: 'evt-action-1',
      customerId: 'cust-800',
      newStatus: 'PENDING_REVIEW'
    })
  );

  assert.ok(first.kind === 'created' || first.kind === 'transitioned');

  const second = await harness.application.processEkycStatusUpdated(
    buildEkycEvent({
      eventId: 'evt-action-2',
      customerId: 'cust-800',
      oldStatus: 'PENDING_REVIEW',
      newStatus: 'ON_HOLD'
    })
  );

  assert.equal(second.kind, 'transitioned');

  const actionEvents = harness.kafkaProducer.events.filter((event) => event.eventName === 'case.action.recorded.v1');
  assert.ok(actionEvents.length >= 2);
});
