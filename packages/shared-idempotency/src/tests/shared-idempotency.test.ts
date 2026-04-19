import assert from 'node:assert/strict';
import test from 'node:test';

import {
  InMemoryIdempotencyStorageAdapter,
  hashRequestIntent,
  processIdempotentApiRequest,
  processIdempotentEventStage
} from '../index.js';

test('same request safely replayed', async () => {
  const storage = new InMemoryIdempotencyStorageAdapter();
  let executionCount = 0;

  const first = await processIdempotentApiRequest({
    scope: 'payment.internal-transfer.create',
    idempotencyKey: 'idem-1',
    requestIntent: { amount: 100, currency: 'USD' },
    storage,
    execute: async () => {
      executionCount += 1;
      return { paymentId: 'pay-1', status: 'ACCEPTED' as const };
    }
  });

  const second = await processIdempotentApiRequest({
    scope: 'payment.internal-transfer.create',
    idempotencyKey: 'idem-1',
    requestIntent: { amount: 100, currency: 'USD' },
    storage,
    execute: async () => {
      executionCount += 1;
      return { paymentId: 'pay-2', status: 'ACCEPTED' as const };
    }
  });

  assert.equal(first.kind, 'executed');
  assert.equal(second.kind, 'replayed');
  assert.equal(executionCount, 1);
  if (second.kind === 'replayed') {
    assert.equal(second.response.paymentId, 'pay-1');
  }
});

test('conflicting duplicate rejected', async () => {
  const storage = new InMemoryIdempotencyStorageAdapter();

  await processIdempotentApiRequest({
    scope: 'customer.create',
    idempotencyKey: 'idem-2',
    requestIntent: { onboardingReference: 'onb-1' },
    storage,
    execute: async () => ({ customerId: 'cust-1' })
  });

  const conflicting = await processIdempotentApiRequest({
    scope: 'customer.create',
    idempotencyKey: 'idem-2',
    requestIntent: { onboardingReference: 'onb-2' },
    storage,
    execute: async () => ({ customerId: 'cust-2' })
  });

  assert.equal(conflicting.kind, 'conflicting_duplicate');
});

test('duplicate blocked while request is in progress', async () => {
  const storage = new InMemoryIdempotencyStorageAdapter();

  await storage.create({
    scope: 'loan.apply',
    idempotencyKey: 'idem-3',
    requestHash: hashRequestIntent({ customerId: 'c-1', amount: 500 }),
    status: 'IN_PROGRESS',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const duplicate = await processIdempotentApiRequest({
    scope: 'loan.apply',
    idempotencyKey: 'idem-3',
    requestIntent: { customerId: 'c-1', amount: 500 },
    storage,
    execute: async () => ({ loanId: 'loan-1' })
  });

  assert.equal(duplicate.kind, 'in_progress_duplicate');
});

test('event helper supports duplicate detection and skip behavior', async () => {
  const storage = new InMemoryIdempotencyStorageAdapter();
  let processedCount = 0;

  const first = await processIdempotentEventStage({
    scope: 'payment-orchestration.consumer',
    stage: 'status-update',
    eventId: 'evt-1',
    eventIntent: { paymentId: 'pay-1', status: 'COMPLETED' },
    storage,
    process: async () => {
      processedCount += 1;
    }
  });

  const second = await processIdempotentEventStage({
    scope: 'payment-orchestration.consumer',
    stage: 'status-update',
    eventId: 'evt-1',
    eventIntent: { paymentId: 'pay-1', status: 'COMPLETED' },
    storage,
    process: async () => {
      processedCount += 1;
    }
  });

  assert.equal(first.kind, 'processed');
  assert.equal(second.kind, 'duplicate');
  assert.equal(processedCount, 1);
});
