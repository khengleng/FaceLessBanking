import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { FeeCollectionApplication } from '../application/fee-collection.application.js';
import { PostgresFeeAdapter } from '../adapters/postgres-fee.adapter.js';
import { PaymentOrchestrationAdapterStub } from '../adapters/payment-orchestration.adapter.js';
import { buildFeeAssessment } from '../domain/fee-assessment.js';
import type { FeeAssessment } from '../domain/fee-assessment.js';
import type { PaymentOrchestrationAdapter } from '../adapters/payment-orchestration.adapter.js';

type TestEventPublisher = {
  emitFeeCollected: (assessment: FeeAssessment, correlationId?: string) => Promise<void>;
  emitFeeFailed: (assessment: FeeAssessment, reason: string, correlationId?: string) => Promise<void>;
};

type TestLogger = {
  info: (payload: Record<string, unknown>, message: string) => void;
  warn: (payload: Record<string, unknown>, message: string) => void;
  error: (payload: Record<string, unknown>, message: string) => void;
};

test('FeeCollectionApplication', async (t) => {
  const postgresAdapter = new PostgresFeeAdapter();
  const eventCounts = { collected: 0, failed: 0 };
  const eventPublisher: TestEventPublisher = {
    emitFeeCollected: async () => { eventCounts.collected++; },
    emitFeeFailed: async () => { eventCounts.failed++; },
  };
  const paymentAdapter = new PaymentOrchestrationAdapterStub();
  const logger: TestLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  const app = new FeeCollectionApplication(
    postgresAdapter,
    eventPublisher,
    paymentAdapter,
    'BANK-INCOME-ACC',
    logger
  );

  const setupAssessment = async () => {
    const assessment = buildFeeAssessment({
      assessmentId: randomUUID(),
      sourceEventId: randomUUID(),
      sourceEntityType: 'payment',
      sourceEntityId: 'pay-1',
      customerId: 'cust-123',
      ruleId: 'rule-1',
      amount: 500,
      currency: 'USD',
      createdAt: new Date().toISOString()
    });
    await postgresAdapter.createFeeAssessment(assessment);
    return assessment;
  };

  await t.test('should collect fee successfully', async () => {
    const assessment = await setupAssessment();

    await app.collectFee(assessment.assessmentId);

    const updated = await postgresAdapter.getFeeAssessment(assessment.assessmentId);
    assert.equal(updated?.status, 'COLLECTED');
    assert.ok(updated?.paymentId);
    assert.equal(eventCounts.collected, 1);
  });

  await t.test('should handle collection failure safely', async () => {
    const assessment = await setupAssessment();

    // Mock failure by overriding initiateInternalTransfer
    const failingPaymentAdapter: PaymentOrchestrationAdapter = {
      initiateInternalTransfer: async () => { throw new Error('Insufficient Funds'); }
    };
    
    const failingApp = new FeeCollectionApplication(
      postgresAdapter,
      eventPublisher,
      failingPaymentAdapter,
      'BANK-INCOME-ACC',
      logger
    );

    await failingApp.collectFee(assessment.assessmentId);

    const updated = await postgresAdapter.getFeeAssessment(assessment.assessmentId);
    assert.equal(updated?.status, 'FAILED');
    assert.equal(updated?.failureReason, 'Insufficient Funds');
    assert.equal(eventCounts.failed, 1);
  });

  await t.test('should be idempotent for assessments already being processed', async () => {
    const assessment = await setupAssessment();
    await postgresAdapter.updateFeeStatus(assessment.assessmentId, 'COLLECTION_PENDING');

    let logWarned = false;
    const loggingApp = new FeeCollectionApplication(
      postgresAdapter,
      eventPublisher,
      paymentAdapter,
      'BANK-INCOME-ACC',
      { ...logger, warn: () => { logWarned = true; } }
    );

    await loggingApp.collectFee(assessment.assessmentId);

    assert.equal(logWarned, true);
  });
});
