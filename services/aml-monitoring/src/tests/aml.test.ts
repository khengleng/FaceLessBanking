import assert from 'node:assert/strict';
import test from 'node:test';

import { InMemoryAMLEventAdapter, InMemoryAMLStoreAdapter } from '../adapters/aml.adapters.js';
import { AMLApplication } from '../application/aml.application.js';

test('suspicious flagged', async () => {
  const store = new InMemoryAMLStoreAdapter();
  const events = new InMemoryAMLEventAdapter();
  const logger = {
    info: (): void => {},
    warn: (): void => {},
    error: (): void => {}
  };

  const app = new AMLApplication(store, events, logger);

  const result = await app.processTransaction({
    eventId: 'evt-aml-1',
    correlationId: 'corr-aml-1',
    transactionId: 'tx-1',
    accountId: 'acct-1',
    amount: 25_000,
    currency: 'USD',
    timestamp: '2026-04-17T00:00:00.000Z'
  });

  assert.equal(result.flagged, true);
  assert.ok(result.alert);
  assert.equal(events.publishedEvents.length, 1);
  assert.equal(events.publishedEvents[0]?.type, 'aml.alert.v1');
});

test('normal ignored', async () => {
  const store = new InMemoryAMLStoreAdapter();
  const events = new InMemoryAMLEventAdapter();
  const logger = {
    info: (): void => {},
    warn: (): void => {},
    error: (): void => {}
  };

  const app = new AMLApplication(store, events, logger);

  await app.processTransaction({
    eventId: 'evt-aml-seed-1',
    correlationId: 'corr-aml-seed-1',
    transactionId: 'tx-seed-1',
    accountId: 'acct-2',
    amount: 100,
    currency: 'USD',
    timestamp: '2026-04-17T00:00:00.000Z'
  });

  const result = await app.processTransaction({
    eventId: 'evt-aml-2',
    correlationId: 'corr-aml-2',
    transactionId: 'tx-2',
    accountId: 'acct-2',
    amount: 150,
    currency: 'USD',
    timestamp: '2026-04-17T00:01:00.000Z'
  });

  assert.equal(result.flagged, false);
  assert.equal(events.publishedEvents.length, 0);

  const alerts = await app.listAlerts();
  assert.equal(alerts.length, 0);
});
