import assert from 'node:assert/strict';
import test from 'node:test';
import { DisputeApplication } from '../application/dispute.application.js';
import { PostgresCaseAdapter } from '../adapters/postgres-case.adapter.js';
import type { DisputeRecord } from '../domain/dispute.js';
import type { CaseRecord } from '../domain/case.js';

test('Dispute / Case Escalation Flow', async (t) => {
  const postgresAdapter = new PostgresCaseAdapter();
  const events = {
    caseCreated: 0,
    disputeCreated: 0,
    disputeUpdated: 0
  };
  
  const eventsPublisher = {
    emitCaseCreated: async (record: CaseRecord) => {
      void record;
      events.caseCreated++;
    },
    emitDisputeCreated: async (record: DisputeRecord) => {
      void record;
      events.disputeCreated++;
    },
    emitDisputeUpdated: async (record: DisputeRecord) => {
      void record;
      events.disputeUpdated++;
    },
  };

  const logger = {
    info: (payload: Record<string, unknown>, message: string) => {
      void payload;
      void message;
    },
    warn: (payload: Record<string, unknown>, message: string) => {
      void payload;
      void message;
    },
    error: (payload: Record<string, unknown>, message: string) => {
      void payload;
      void message;
    },
  };

  const app = new DisputeApplication(
    postgresAdapter,
    eventsPublisher,
    logger
  );

  await t.test('should create a dispute and linked case', async () => {
    const dispute = await app.createDispute({
      entityType: 'payment',
      entityId: 'pay-123',
      customerId: 'cust-456',
      amount: 100,
      currency: 'USD',
      reason: 'Unauthorized transaction'
    });

    assert.ok(dispute.disputeId);
    assert.equal(dispute.status, 'OPEN');
    assert.equal(events.caseCreated, 1);
    assert.equal(events.disputeCreated, 1);

    const reviewCase = await postgresAdapter.getCaseById(dispute.disputeId);
    assert.ok(reviewCase);
    assert.equal(reviewCase?.caseType, 'dispute-review');
    assert.equal(reviewCase?.referenceId, 'pay-123');
  });

  await t.test('should escalate an open dispute', async () => {
    const dispute = await app.createDispute({
      entityType: 'account',
      entityId: 'acc-123',
      customerId: 'cust-456',
      amount: 0,
      currency: 'USD',
      reason: 'Limit issue'
    });

    const escalated = await app.escalateDispute(dispute.disputeId);
    assert.equal(escalated.status, 'ESCALATED');
    assert.equal(escalated.escalationLevel, 1);
    assert.equal(events.disputeUpdated, 1);
  });

  await t.test('should resolve a dispute', async () => {
    const dispute = await app.createDispute({
      entityType: 'loan',
      entityId: 'loan-123',
      customerId: 'cust-456',
      amount: 500,
      currency: 'USD',
      reason: 'Interest miscalculation'
    });

    const resolved = await app.resolveDispute(dispute.disputeId, 'RESOLVED');
    assert.equal(resolved.status, 'RESOLVED');
  });

  await t.test('should block invalid transitions', async () => {
    const dispute = await app.createDispute({
      entityType: 'payment',
      entityId: 'pay-999',
      customerId: 'cust-456',
      amount: 50,
      currency: 'USD',
      reason: 'Test failure'
    });

    await app.resolveDispute(dispute.disputeId, 'REJECTED');
    
    // Cannot escalate from REJECTED
    await assert.rejects(
      app.escalateDispute(dispute.disputeId),
      { message: /Cannot escalate dispute in REJECTED status/ }
    );
  });
});
