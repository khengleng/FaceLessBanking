import assert from 'node:assert/strict';
import test from 'node:test';
import { LimitsApplication } from '../application/limits.application.js';
import { PostgresLimitsAdapter } from '../adapters/postgres-limits.adapter.js';
import { WorkflowAdapterStub } from '../adapters/workflow.adapter.js';
import type { LimitsEventsPublisher } from '../events/limits-publisher.js';

test('Limits Engine Flow', async (t) => {
  const postgresAdapter = new PostgresLimitsAdapter();
  const workflowAdapter = new WorkflowAdapterStub();
  const eventPublisher: Pick<LimitsEventsPublisher, 'emitLimitDecision'> = {
    emitLimitDecision: async () => {}
  };
  const logger = { info: () => {}, warn: () => {}, error: () => {} };
  
  const app = new LimitsApplication(
    postgresAdapter,
    workflowAdapter,
    eventPublisher,
    logger
  );

  // Setup a rule
  const ruleId = 'rule-daily-1000';
  await app.createRule({
    ruleId,
    entityType: 'CUSTOMER',
    entityId: 'ALL',
    limitType: 'DAILY_TX_LIMIT',
    thresholdAmountCents: 100000n, // $1000
    currency: 'USD',
    period: 'DAILY',
    status: 'ACTIVE',
    requireApproval: false
  });

  await t.test('within limit is ALLOWED', async () => {
    const result = await app.evaluateLimit({
      entityType: 'CUSTOMER',
      entityId: 'cust-1',
      amountCents: 50000n, // $500
      currency: 'USD',
      action: 'PAYMENT'
    });

    assert.equal(result.decision, 'ALLOWED');
  });

  await t.test('exceeding hard limit is BLOCKED', async () => {
    const result = await app.evaluateLimit({
      entityType: 'CUSTOMER',
      entityId: 'cust-1',
      amountCents: 100001n, // $1000.01
      currency: 'USD',
      action: 'PAYMENT'
    });

    assert.equal(result.decision, 'BLOCKED');
  });

  await t.test('exceeding soft limit triggers OVERRIDE_REQUIRED', async () => {
    const softRuleId = 'rule-soft-500';
    await app.createRule({
      ruleId: softRuleId,
      entityType: 'CUSTOMER',
      entityId: 'cust-soft',
      limitType: 'DAILY_TX_LIMIT',
      thresholdAmountCents: 50000n, // $500
      currency: 'USD',
      period: 'DAILY',
      status: 'ACTIVE',
      requireApproval: true
    });

    const result = await app.evaluateLimit({
      entityType: 'CUSTOMER',
      entityId: 'cust-soft',
      amountCents: 60000n, // $600
      currency: 'USD',
      action: 'PAYMENT'
    });

    assert.equal(result.decision, 'OVERRIDE_REQUIRED');
  });

  await t.test('usage accumulation works', async () => {
    const accRuleId = 'rule-acc-100';
    await app.createRule({
      ruleId: accRuleId,
      entityType: 'CUSTOMER',
      entityId: 'cust-acc',
      limitType: 'DAILY_TX_LIMIT',
      thresholdAmountCents: 10000n, // $100
      currency: 'USD',
      period: 'DAILY',
      status: 'ACTIVE',
      requireApproval: false
    });

    // Record usage of $60
    await app.recordUsage({ ruleId: accRuleId, entityId: 'cust-acc', amountCents: 6000n });

    // Evaluate $50 -> Should be blocked ($60 + $50 > $100)
    const result = await app.evaluateLimit({
      entityType: 'CUSTOMER',
      entityId: 'cust-acc',
      amountCents: 5000n,
      currency: 'USD',
      action: 'PAYMENT'
    });

    assert.equal(result.decision, 'BLOCKED');
  });
});
