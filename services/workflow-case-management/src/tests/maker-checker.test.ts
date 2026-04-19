import assert from 'node:assert/strict';
import test from 'node:test';
import { MakerCheckerApplication } from '../application/maker-checker.application.js';
import { PostgresCaseAdapter } from '../adapters/postgres-case.adapter.js';
import type { CaseRecord } from '../domain/case.js';
import type { MakerCheckerDecision } from '../domain/maker-checker.js';

test('Maker-Checker Policy Layer', async (t) => {
  const postgresAdapter = new PostgresCaseAdapter();
  const eventsPublisher = {
    emitCaseCreated: async (record: CaseRecord) => {
      void record;
    },
    emitMakerCheckerPolicyApplied: async (decision: MakerCheckerDecision) => {
      void decision;
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

  const app = new MakerCheckerApplication(
    postgresAdapter,
    eventsPublisher,
    logger
  );

  await t.test('should create a maker-checker policy', async () => {
    const policy = await app.createPolicy({
      actionType: 'LOAN_APPROVAL',
      caseType: 'loan-review',
      thresholdAmount: 1000
    });

    assert.ok(policy.policyId);
    assert.equal(policy.actionType, 'LOAN_APPROVAL');

    const retrieved = await app.getPolicy(policy.policyId);
    assert.deepEqual(retrieved, policy);
  });

  await t.test('should return direct-allowed if no policy matches', async () => {
    const decision = await app.evaluateAction({
      actionType: 'MANUAL_PAYMENT_RELEASE',
      referenceId: 'ref-123'
    });

    assert.equal(decision.requiresApproval, false);
    assert.equal(decision.caseId, undefined);
  });

  await t.test('should return requiresApproval and create a case if policy matches', async () => {
    const events = {
      caseCreated: 0,
      policyApplied: 0
    };
    
    const mockEventsPublisher = {
      emitCaseCreated: async (record: CaseRecord) => {
        void record;
        events.caseCreated++;
      },
      emitMakerCheckerPolicyApplied: async (decision: MakerCheckerDecision) => {
        void decision;
        events.policyApplied++;
      },
    };

    const appWithMocks = new MakerCheckerApplication(postgresAdapter, mockEventsPublisher, logger);

    await appWithMocks.createPolicy({
      actionType: 'LOAN_APPROVAL',
      caseType: 'loan-review'
    });

    const decision = await appWithMocks.evaluateAction({
      actionType: 'LOAN_APPROVAL',
      referenceId: 'loan-123'
    });

    assert.equal(decision.requiresApproval, true);
    assert.ok(decision.caseId);
    assert.equal(events.caseCreated, 1);
    assert.equal(events.policyApplied, 1);

    const reviewCase = await postgresAdapter.getCaseById(decision.caseId!);
    assert.equal(reviewCase?.caseType, 'loan-review');
    assert.equal(reviewCase?.referenceId, 'loan-123');
  });

  await t.test('should respect thresholdAmount in policy', async () => {
    const freshAdapter = new PostgresCaseAdapter();
    const freshApp = new MakerCheckerApplication(freshAdapter, eventsPublisher, logger);

    await freshApp.createPolicy({
      actionType: 'LOAN_APPROVAL',
      caseType: 'loan-review',
      thresholdAmount: 5000
    });

    // Below threshold
    const decision1 = await freshApp.evaluateAction({
      actionType: 'LOAN_APPROVAL',
      amount: 4000,
      referenceId: 'loan-low'
    });
    assert.equal(decision1.requiresApproval, false);

    // Above threshold
    const decision2 = await freshApp.evaluateAction({
      actionType: 'LOAN_APPROVAL',
      amount: 6000,
      referenceId: 'loan-high'
    });
    assert.equal(decision2.requiresApproval, true);
  });
});
