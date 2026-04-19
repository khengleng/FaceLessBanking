import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';
import type { BalanceSnapshot } from '../domain/balance.js';

function createMockDb(initialSnapshot: BalanceSnapshot | null = null) {
  let snapshot = initialSnapshot;
  const processedEvents = new Set<string>();

  return {
    getSnapshot: () => snapshot,
    processedEvents,
    query: async (text: string, params: unknown[] = []) => {
      if (text.includes('FROM balance_projections')) {
        if (!snapshot || params[0] !== snapshot.accountId) {
          return { rowCount: 0, rows: [] };
        }

        return {
          rowCount: 1,
          rows: [{
            account_id: snapshot.accountId,
            available_balance: snapshot.availableBalance,
            ledger_balance: snapshot.ledgerBalance,
            currency: snapshot.currency,
            version: snapshot.version,
            updated_at: snapshot.updatedAt
          }]
        };
      }

      if (text.includes('INSERT INTO balance_projections')) {
        snapshot = {
          accountId: String(params[0]),
          availableBalance: Number(params[1]),
          ledgerBalance: Number(params[2]),
          currency: String(params[3]),
          version: Number(params[4]),
          updatedAt: String(params[5])
        };
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('FROM balance_projection_events')) {
        return {
          rowCount: processedEvents.has(String(params[0])) ? 1 : 0,
          rows: []
        };
      }

      if (text.includes('INSERT INTO balance_projection_events')) {
        processedEvents.add(String(params[0]));
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    }
  };
}

function createMockRedis(initial?: Record<string, BalanceSnapshot>) {
  const data = new Map<string, string>();

  if (initial) {
    for (const [accountId, snapshot] of Object.entries(initial)) {
      data.set(`balance:${accountId}`, JSON.stringify(snapshot));
    }
  }

  return {
    data,
    get: async (key: string) => data.get(key) ?? null,
    set: async (key: string, value: string, ...args: unknown[]) => {
      void args;
      data.set(key, value);
    }
  };
}

test('GET /health returns health payload', async () => {
  const db = createMockDb();
  const app = createApp({
    db,
    redis: createMockRedis()
  });

  const response = await app.inject({ method: 'GET', url: '/health' });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { status: string; service: string };
  assert.equal(payload.status, 'ok');
  assert.equal(payload.service, 'balance-service');

  await app.close();
});

test('GET /balances/:accountId returns from Redis on hit', async () => {
  const redis = createMockRedis({
    acct_1: {
      accountId: 'acct_1',
      availableBalance: 1000,
      ledgerBalance: 1000,
      currency: 'USD',
      version: 3,
      updatedAt: '2026-04-13T00:00:00.000Z'
    }
  });

  const app = createApp({ db: createMockDb(), redis });

  const response = await app.inject({
    method: 'GET',
    url: '/balances/acct_1',
    headers: { 'x-correlation-id': 'corr-hit' }
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as {
    success: boolean;
    correlationId: string;
    data: { accountId: string; source: string };
  };
  assert.equal(payload.success, true);
  assert.equal(payload.correlationId, 'corr-hit');
  assert.equal(payload.data.accountId, 'acct_1');
  assert.equal(payload.data.source, 'redis');

  await app.close();
});

test('GET /balances/:accountId falls back to PostgreSQL on Redis miss', async () => {
  const snapshot: BalanceSnapshot = {
    accountId: 'acct_2',
    availableBalance: 2000,
    ledgerBalance: 2500,
    currency: 'USD',
    version: 5,
    updatedAt: '2026-04-13T00:00:00.000Z'
  };

  const db = createMockDb(snapshot);
  const redis = createMockRedis();
  const app = createApp({ db, redis });

  const response = await app.inject({
    method: 'GET',
    url: '/balances/acct_2',
    headers: { 'x-correlation-id': 'corr-fallback' }
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as {
    success: boolean;
    data: { accountId: string; source: string };
  };
  assert.equal(payload.success, true);
  assert.equal(payload.data.accountId, 'acct_2');
  assert.equal(payload.data.source, 'postgres');

  await app.close();
});

test('GET /balances/:accountId repopulates Redis after PostgreSQL fallback', async () => {
  const snapshot: BalanceSnapshot = {
    accountId: 'acct_3',
    availableBalance: 500,
    ledgerBalance: 600,
    currency: 'USD',
    version: 2,
    updatedAt: '2026-04-13T00:00:00.000Z'
  };

  const db = createMockDb(snapshot);
  const redis = createMockRedis();
  const app = createApp({ db, redis });

  const response = await app.inject({ method: 'GET', url: '/balances/acct_3' });
  assert.equal(response.statusCode, 200);

  const cached = await redis.get('balance:acct_3');
  assert.ok(cached);
  const parsed = JSON.parse(cached ?? '{}') as BalanceSnapshot;
  assert.equal(parsed.accountId, 'acct_3');
  assert.equal(parsed.availableBalance, 500);

  await app.close();
});

test('GET /balances/:accountId returns not found when both sources miss', async () => {
  const app = createApp({ db: createMockDb(), redis: createMockRedis() });

  const response = await app.inject({ method: 'GET', url: '/balances/acct_unknown' });

  assert.equal(response.statusCode, 404);
  const payload = response.json() as { success: boolean; error: { code: string } };
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'not_found');

  await app.close();
});

test('POST /balances/events/apply updates projection and cache', async () => {
  const db = createMockDb();
  const redis = createMockRedis();
  const app = createApp({ db, redis });

  const response = await app.inject({
    method: 'POST',
    url: '/balances/events/apply',
    headers: {
      'x-internal-request': 'true',
      'x-correlation-id': 'corr-apply'
    },
    payload: {
      eventId: 'evt_1',
      accountId: 'acct_apply',
      deltaAmount: 150,
      currency: 'USD',
      timestamp: '2026-04-13T00:00:01.000Z',
      correlationId: 'corr-apply'
    }
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { success: boolean; data: { status: string } };
  assert.equal(payload.success, true);
  assert.equal(payload.data.status, 'applied');

  const cached = await redis.get('balance:acct_apply');
  assert.ok(cached);

  await app.close();
});

test('POST /balances/events/apply duplicate eventId does not apply projection twice', async () => {
  const db = createMockDb();
  const redis = createMockRedis();
  const app = createApp({ db, redis });

  const requestPayload = {
    eventId: 'evt_dup',
    accountId: 'acct_dup',
    deltaAmount: 10,
    currency: 'USD',
    timestamp: '2026-04-13T00:00:01.000Z',
    correlationId: 'corr-dup'
  };

  const first = await app.inject({
    method: 'POST',
    url: '/balances/events/apply',
    headers: { 'x-internal-request': 'true' },
    payload: requestPayload
  });
  assert.equal(first.statusCode, 200);

  const second = await app.inject({
    method: 'POST',
    url: '/balances/events/apply',
    headers: { 'x-internal-request': 'true' },
    payload: requestPayload
  });

  assert.equal(second.statusCode, 200);
  const payload = second.json() as { success: boolean; data: { status: string } };
  assert.equal(payload.success, true);
  assert.equal(payload.data.status, 'duplicate_event');

  const snapshot = db.getSnapshot();
  assert.equal(snapshot?.version, 1);

  await app.close();
});

test('POST /balances/events/apply invalid payload returns validation error', async () => {
  const app = createApp({ db: createMockDb(), redis: createMockRedis() });

  const response = await app.inject({
    method: 'POST',
    url: '/balances/events/apply',
    headers: { 'x-internal-request': 'true' },
    payload: {
      eventId: '',
      accountId: 'x',
      deltaAmount: 'not-number',
      currency: 'US'
    }
  });

  assert.equal(response.statusCode, 400);
  const payload = response.json() as { success: boolean; error: { code: string } };
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'validation_failed');

  await app.close();
});
