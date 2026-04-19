import assert from 'node:assert/strict';
import test from 'node:test';

import { PostgresAuditAdapter } from '../adapters/postgres-audit.adapter.js';
import { PaymentAuditEnricherApplication } from '../application/payment-audit-enricher.application.js';
import { AuditLifecycleMetrics } from '../events/metrics.js';

function buildInitiatedEvent(eventId: string, correlationId = 'corr-payment-1') {
  return {
    specVersion: '1.0',
    type: 'payment.initiated.v1',
    version: 1,
    metadata: {
      eventId,
      correlationId,
      timestamp: new Date().toISOString(),
      producer: 'payment-orchestration'
    },
    payload: {
      paymentId: 'pay-001',
      sourceAccountId: 'source-account-12345678',
      destinationAccountId: 'destination-account-87654321',
      amount: 125.5,
      currency: 'USD',
      channel: 'internal-transfer'
    }
  };
}

function buildStatusUpdatedEvent(eventId: string, correlationId = 'corr-payment-2') {
  return {
    specVersion: '1.0',
    type: 'payment.status.updated.v1',
    version: 1,
    metadata: {
      eventId,
      correlationId,
      timestamp: new Date().toISOString(),
      producer: 'payment-orchestration'
    },
    payload: {
      paymentId: 'pay-001',
      sourceAccountId: 'source-account-12345678',
      destinationAccountId: 'destination-account-87654321',
      amount: 125.5,
      currency: 'USD',
      previousStatus: 'PROCESSING',
      status: 'COMPLETED',
      reason: 'processed_successfully'
    }
  };
}

function buildHarness() {
  const auditAdapter = new PostgresAuditAdapter();
  const metrics = new AuditLifecycleMetrics();

  const application = new PaymentAuditEnricherApplication(
    auditAdapter,
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
    auditAdapter,
    metrics
  };
}

test('consume payment.initiated.v1 creates audit event', async () => {
  const harness = buildHarness();

  const result = await harness.application.processLifecycleEvent(
    buildInitiatedEvent('evt-init-1')
  );

  assert.equal(result.kind, 'created');
  if (result.kind !== 'created') {
    return;
  }

  assert.equal(result.auditEvent.eventType, 'payment.initiated.v1');
  assert.equal(result.auditEvent.entityType, 'PAYMENT');
  assert.equal(result.auditEvent.entityId, 'pay-001');
  assert.equal(harness.metrics.auditRecordsCreated, 1);
});

test('consume payment.status.updated.v1 creates audit event', async () => {
  const harness = buildHarness();

  const result = await harness.application.processLifecycleEvent(
    buildStatusUpdatedEvent('evt-status-1')
  );

  assert.equal(result.kind, 'created');
  if (result.kind !== 'created') {
    return;
  }

  assert.equal(result.auditEvent.eventType, 'payment.status.updated.v1');
  assert.equal(result.auditEvent.entityType, 'PAYMENT');
  assert.equal(result.auditEvent.entityId, 'pay-001');
  assert.equal(result.auditEvent.payload.status, 'COMPLETED');
});

test('duplicate source event does not create duplicate audit event', async () => {
  const harness = buildHarness();
  const event = buildInitiatedEvent('evt-dup-1');

  const first = await harness.application.processLifecycleEvent(event);
  assert.equal(first.kind, 'created');

  const second = await harness.application.processLifecycleEvent(event);
  assert.equal(second.kind, 'duplicate');
  assert.equal(harness.metrics.duplicateAuditEventsSkipped, 1);
});

test('malformed event is handled safely', async () => {
  const harness = buildHarness();

  const result = await harness.application.processLifecycleEvent({
    specVersion: '1.0',
    type: 'payment.initiated.v1',
    version: 1,
    metadata: {
      eventId: 'evt-bad',
      correlationId: 'corr-bad',
      timestamp: new Date().toISOString(),
      producer: 'payment-orchestration'
    },
    payload: {
      paymentId: 'pay-001'
    }
  });

  assert.equal(result.kind, 'invalid_event');
  assert.equal(harness.metrics.malformedLifecycleEventsRejected, 1);
});

test('stored audit record includes searchable entityId and correlationId', async () => {
  const harness = buildHarness();

  const event = buildStatusUpdatedEvent('evt-search-1', 'corr-search-1');
  const result = await harness.application.processLifecycleEvent(event);

  assert.equal(result.kind, 'created');

  const byEntity = await harness.auditAdapter.getAuditByEntityId('PAYMENT', 'pay-001');
  const byCorrelation = await harness.auditAdapter.getAuditByCorrelationId('corr-search-1');

  assert.equal(byEntity.length, 1);
  assert.equal(byCorrelation.length, 1);
  assert.equal(byCorrelation[0]?.sourceEventId, 'evt-search-1');
});

test('unsafe fields are not persisted', async () => {
  const harness = buildHarness();

  const result = await harness.application.processLifecycleEvent(
    buildInitiatedEvent('evt-safe-1')
  );

  assert.equal(result.kind, 'created');
  if (result.kind !== 'created') {
    return;
  }

  const payload = result.auditEvent.payload;

  assert.equal(payload.sourceAccountId, undefined);
  assert.equal(payload.destinationAccountId, undefined);
  assert.equal(typeof payload.sourceAccountIdMasked, 'string');
  assert.equal(typeof payload.destinationAccountIdMasked, 'string');
  assert.equal(String(payload.sourceAccountIdMasked).startsWith('****'), true);
  assert.equal(String(payload.destinationAccountIdMasked).startsWith('****'), true);
});
