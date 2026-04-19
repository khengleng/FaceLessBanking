import assert from 'node:assert/strict';
import test from 'node:test';

import { InMemorySuspenseStoreAdapter } from '../adapters/suspense.adapters.js';
import { SuspenseApplication } from '../application/suspense.application.js';

test('suspense created', async () => {
  const store = new InMemorySuspenseStoreAdapter();
  const logger = {
    info: (): void => {},
    warn: (): void => {},
    error: (): void => {}
  };

  const app = new SuspenseApplication(store, logger);

  const entry = await app.recordUnmatchedTransaction({
    amount: 125.75,
    reason: 'Unmatched incoming transfer'
  });

  assert.equal(entry.amount, 125.75);
  assert.equal(entry.reason, 'Unmatched incoming transfer');
  assert.equal(entry.status, 'SUSPENSE');

  const listed = await app.listSuspense();
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.entryId, entry.entryId);
});

test('resolved correctly', async () => {
  const store = new InMemorySuspenseStoreAdapter();
  const logger = {
    info: (): void => {},
    warn: (): void => {},
    error: (): void => {}
  };

  const app = new SuspenseApplication(store, logger);

  const entry = await app.recordUnmatchedTransaction({
    amount: 90,
    reason: 'Unidentified debit'
  });

  const resolved = await app.resolveSuspense({
    entryId: entry.entryId,
    idempotencyKey: 'idem-suspense-resolve-1',
    correlationId: 'corr-suspense-resolve-1'
  });

  assert.equal(resolved.status, 'CLEARED');

  const second = await app.resolveSuspense({
    entryId: entry.entryId,
    idempotencyKey: 'idem-suspense-resolve-1',
    correlationId: 'corr-suspense-resolve-1'
  });

  assert.equal(second.status, 'CLEARED');
  assert.equal(second.entryId, resolved.entryId);
});
