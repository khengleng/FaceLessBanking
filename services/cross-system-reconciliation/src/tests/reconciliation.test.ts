import assert from 'node:assert/strict';
import test from 'node:test';

import {
  InMemoryAlertAdapter,
  InMemoryReconciliationStoreAdapter,
  InMemorySourceDataAdapter
} from '../adapters/reconciliation.adapters.js';
import { ReconciliationApplication } from '../application/reconciliation.application.js';

test('mismatch detected', async () => {
  const source = new InMemorySourceDataAdapter();
  source.setSnapshot({
    pair: 'ledger_vs_accounting',
    sourceSystem: 'ledger',
    targetSystem: 'accounting',
    sourceAmount: 1000,
    targetAmount: 900
  });

  const store = new InMemoryReconciliationStoreAdapter();
  const alert = new InMemoryAlertAdapter();
  const logger = {
    info: (): void => {},
    warn: (): void => {},
    error: (): void => {}
  };

  const app = new ReconciliationApplication(source, store, alert, logger);

  const run = await app.runReconciliation({
    idempotencyKey: 'idem-run-mismatch-1',
    correlationId: 'corr-run-mismatch-1'
  });

  assert.equal(run.hasMismatch, true);
  assert.equal(run.results.some((result) => result.status === 'MISMATCH'), true);
  assert.equal(alert.alerts.length > 0, true);
});

test('reconciliation passes', async () => {
  const source = new InMemorySourceDataAdapter();
  source.setSnapshot({
    pair: 'ledger_vs_accounting',
    sourceSystem: 'ledger',
    targetSystem: 'accounting',
    sourceAmount: 1000,
    targetAmount: 1000
  });
  source.setSnapshot({
    pair: 'payments_vs_balances',
    sourceSystem: 'payments',
    targetSystem: 'balances',
    sourceAmount: 500,
    targetAmount: 500
  });
  source.setSnapshot({
    pair: 'internal_vs_external',
    sourceSystem: 'internal',
    targetSystem: 'external',
    sourceAmount: 250,
    targetAmount: 250
  });

  const store = new InMemoryReconciliationStoreAdapter();
  const alert = new InMemoryAlertAdapter();
  const logger = {
    info: (): void => {},
    warn: (): void => {},
    error: (): void => {}
  };

  const app = new ReconciliationApplication(source, store, alert, logger);

  const run = await app.runReconciliation({
    idempotencyKey: 'idem-run-pass-1',
    correlationId: 'corr-run-pass-1'
  });

  assert.equal(run.hasMismatch, false);
  assert.equal(run.results.every((result) => result.status === 'MATCH'), true);
  assert.equal(alert.alerts.length, 0);
});
