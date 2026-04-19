import { test, describe } from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { FeeEngineApplication } from '../application/fee-engine.application.js';
import type { FeeRule } from '../domain/fee-rule.js';
import type { FeeAssessment } from '../domain/fee-assessment.js';

type FeeEventEnvelope = {
  metadata: { eventId: string; correlationId: string };
  type: string;
  payload: {
    paymentId?: string;
    loanAccountId?: string;
    amountCents?: number;
  };
};

type FeePostgresAdapter = {
  createFeeRule: (rule: FeeRule) => Promise<void>;
  getFeeRuleById: (ruleId: string) => Promise<FeeRule | null>;
  findApplicableFeeRules: (eventType: string) => Promise<FeeRule[]>;
  hasProcessedFeeEvent: (sourceEventId: string) => Promise<boolean>;
  markFeeEventProcessed: (sourceEventId: string) => Promise<void>;
  createFeeAssessment: (assessment: FeeAssessment) => Promise<void>;
};

type FeeEventsPublisher = {
  emitFeeAssessed: (assessment: FeeAssessment, correlationId?: string) => Promise<void>;
};

const mockPostgresAdapter: FeePostgresAdapter = {
  createFeeRule: async () => {},
  getFeeRuleById: async () => null,
  findApplicableFeeRules: async () => [],
  hasProcessedFeeEvent: async () => false,
  markFeeEventProcessed: async () => {},
  createFeeAssessment: async () => {}
};

const mockEventsPublisher: FeeEventsPublisher = {
  emitFeeAssessed: async () => {}
};

const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {}
};

describe('FeeEngineApplication', () => {
  test('transfer fee rule evaluates correctly', async () => {
    const ruleId = randomUUID();
    const adapter = {
      ...mockPostgresAdapter,
      findApplicableFeeRules: async () => [{
        ruleId,
        ruleType: 'FIXED',
        triggerEventType: 'payment.initiated.v1',
        fixedAmountCents: 50,
        currency: 'USD',
        status: 'ACTIVE'
      }]
    };
    
    const app = new FeeEngineApplication(adapter, mockEventsPublisher, mockLogger);
    const event: FeeEventEnvelope = {
      metadata: { eventId: randomUUID(), correlationId: randomUUID() },
      type: 'payment.initiated.v1',
      payload: { paymentId: 'pay-1', amountCents: 1000 }
    };

    const result = await app.evaluateEvent(event);
    assert.strictEqual(result.kind, 'assessed');
    assert.strictEqual(result.assessments?.[0].assessedAmountCents, 50);
  });

  test('loan disbursement fee rule evaluates correctly (percentage)', async () => {
    const ruleId = randomUUID();
    const adapter = {
      ...mockPostgresAdapter,
      findApplicableFeeRules: async () => [{
        ruleId,
        ruleType: 'PERCENTAGE',
        triggerEventType: 'loan.disbursement.initiated.v1',
        percentage: 0.01, // 1%
        currency: 'USD',
        status: 'ACTIVE'
      }]
    };
    
    const app = new FeeEngineApplication(adapter, mockEventsPublisher, mockLogger);
    const event: FeeEventEnvelope = {
      metadata: { eventId: randomUUID(), correlationId: randomUUID() },
      type: 'loan.disbursement.initiated.v1',
      payload: { loanAccountId: 'loan-1', amountCents: 100000 } // 1000.00 USD
    };

    const result = await app.evaluateEvent(event);
    assert.strictEqual(result.kind, 'assessed');
    assert.strictEqual(result.assessments?.[0].assessedAmountCents, 1000); // 10.00 USD
  });

  test('duplicate source event is skipped', async () => {
    const adapter = {
      ...mockPostgresAdapter,
      hasProcessedFeeEvent: async () => true
    };
    
    const app = new FeeEngineApplication(adapter, mockEventsPublisher, mockLogger);
    const event: FeeEventEnvelope = {
      metadata: { eventId: 'dup-1', correlationId: randomUUID() },
      type: 'payment.initiated.v1',
      payload: {}
    };

    const result = await app.evaluateEvent(event);
    assert.strictEqual(result.kind, 'duplicate');
  });

  test('inactive rule is not applied', async () => {
    const adapter = {
      ...mockPostgresAdapter,
      findApplicableFeeRules: async () => [{
        ruleId: 'r-1',
        ruleType: 'FIXED',
        triggerEventType: 'payment.initiated.v1',
        fixedAmountCents: 50,
        currency: 'USD',
        status: 'INACTIVE'
      }]
    };
    
    const app = new FeeEngineApplication(adapter, mockEventsPublisher, mockLogger);
    const event: FeeEventEnvelope = {
      metadata: { eventId: randomUUID(), correlationId: randomUUID() },
      type: 'payment.initiated.v1',
      payload: {}
    };

    const result = await app.evaluateEvent(event);
    assert.strictEqual(result.kind, 'assessed');
    assert.strictEqual(result.assessments?.length, 0);
  });
});
