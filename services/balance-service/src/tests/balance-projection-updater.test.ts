import assert from 'node:assert/strict';
import test from 'node:test';

import { PostgresBalanceProjectionAdapter } from '../adapters/postgres-balance-projection.adapter.js';
import { RedisBalanceAdapter } from '../adapters/redis-balance.adapter.js';
import { BalanceProjectionUpdaterApplication } from '../application/balance-projection-updater.application.js';
import type { BalanceSnapshot } from '../domain/balance.js';
import { BalanceMetrics } from '../events/metrics.js';

function createMockDb(initial: BalanceSnapshot[] = []) {
  const snapshots = new Map<string, BalanceSnapshot>();
  for (const snapshot of initial) {
    snapshots.set(snapshot.accountId, snapshot);
  }

  const processedEvents = new Set<string>();

  return {
    snapshots,
    processedEvents,
    query: async (text: string, params: unknown[] = []) => {
      if (text.includes('FROM balance_projections')) {
        const accountId = String(params[0]);
        const snapshot = snapshots.get(accountId);
        if (!snapshot) {
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
        const snapshot: BalanceSnapshot = {
          accountId: String(params[0]),
          availableBalance: Number(params[1]),
          ledgerBalance: Number(params[2]),
          currency: String(params[3]),
          version: Number(params[4]),
          updatedAt: String(params[5])
        };
        snapshots.set(snapshot.accountId, snapshot);
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('FROM balance_projection_events')) {
        const eventId = String(params[0]);
        return {
          rowCount: processedEvents.has(eventId) ? 1 : 0,
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

function createMockRedis() {
  const data = new Map<string, string>();

  return {
    data,
    get: async (key: string) => data.get(key) ?? null,
    set: async (key: string, value: string, ...args: unknown[]) => {
      void args;
      data.set(key, value);
    }
  };
}

function buildEvent(input: {
  eventId: string;
  status: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  amount?: number;
  currency?: string;
  correlationId?: string;
}) {
  return {
    specVersion: '1.0',
    type: 'payment.status.updated.v1',
    version: 1,
    metadata: {
      eventId: input.eventId,
      correlationId: input.correlationId ?? 'corr-balance-projection',
      timestamp: new Date().toISOString(),
      producer: 'payment-orchestration'
    },
    payload: {
      paymentId: 'payment-1',
      sourceAccountId: input.sourceAccountId ?? 'acc-source-1',
      destinationAccountId: input.destinationAccountId ?? 'acc-dest-1',
      amount: input.amount ?? 100,
      currency: input.currency ?? 'USD',
      previousStatus: 'PROCESSING',
      status: input.status,
      reason: 'processed_successfully'
    }
  };
}

function buildUpdater(initialSnapshots: BalanceSnapshot[] = []) {
  const dbClient = createMockDb(initialSnapshots);
  const redisClient = createMockRedis();
  const postgresAdapter = new PostgresBalanceProjectionAdapter(dbClient);
  const redisAdapter = new RedisBalanceAdapter(redisClient, {
    keyPrefix: 'balance:',
    ttlSeconds: 120
  });
  const metrics = new BalanceMetrics();

  const updater = new BalanceProjectionUpdaterApplication(
    postgresAdapter,
    redisAdapter,
    metrics,
    120,
    {
      info: (payload: Record<string, unknown>, message: string): void => {
        void payload;
        void message;
      },
      warn: (payload: Record<string, unknown>, message: string): void => {
        void payload;
        void message;
      },
      error: (payload: Record<string, unknown>, message: string): void => {
        void payload;
        void message;
      }
    }
  );

  return {
    updater,
    dbClient,
    redisClient,
    metrics
  };
}

test('consume payment.status.updated.v1 COMPLETED updates source and destination balances', async () => {
  const harness = buildUpdater([
    {
      accountId: 'acc-source-1',
      availableBalance: 1000,
      ledgerBalance: 1000,
      currency: 'USD',
      version: 2,
      updatedAt: '2026-04-13T00:00:00.000Z'
    },
    {
      accountId: 'acc-dest-1',
      availableBalance: 500,
      ledgerBalance: 500,
      currency: 'USD',
      version: 1,
      updatedAt: '2026-04-13T00:00:00.000Z'
    }
  ]);

  const result = await harness.updater.processPaymentStatusUpdated(buildEvent({
    eventId: 'evt-completed-1',
    status: 'COMPLETED',
    amount: 250
  }));

  assert.equal(result.kind, 'applied');

  const source = harness.dbClient.snapshots.get('acc-source-1');
  const destination = harness.dbClient.snapshots.get('acc-dest-1');

  assert.equal(source?.availableBalance, 750);
  assert.equal(source?.ledgerBalance, 750);
  assert.equal(destination?.availableBalance, 750);
  assert.equal(destination?.ledgerBalance, 750);
});

test('duplicate event does not apply twice', async () => {
  const harness = buildUpdater();

  const event = buildEvent({ eventId: 'evt-dup-1', status: 'COMPLETED', amount: 100 });

  const first = await harness.updater.processPaymentStatusUpdated(event);
  assert.equal(first.kind, 'applied');

  const second = await harness.updater.processPaymentStatusUpdated(event);
  assert.equal(second.kind, 'duplicate_event');
  assert.equal(harness.metrics.duplicateProjectionEventsSkipped, 1);
});

test('ACCEPTED/PENDING/PROCESSING events do not mutate balances', async () => {
  for (const status of ['ACCEPTED', 'PENDING', 'PROCESSING']) {
    const harness = buildUpdater();

    const result = await harness.updater.processPaymentStatusUpdated(buildEvent({
      eventId: `evt-no-mutate-${status}`,
      status
    }));

    assert.equal(result.kind, 'ignored_status');
    assert.equal(harness.dbClient.snapshots.size, 0);
  }
});

test('FAILED/REJECTED events do not mutate balances', async () => {
  for (const status of ['FAILED', 'REJECTED']) {
    const harness = buildUpdater();

    const result = await harness.updater.processPaymentStatusUpdated(buildEvent({
      eventId: `evt-fail-no-mutate-${status}`,
      status
    }));

    assert.equal(result.kind, 'ignored_status');
    assert.equal(harness.dbClient.snapshots.size, 0);
  }
});

test('Redis cache is updated after projection success', async () => {
  const harness = buildUpdater();

  const result = await harness.updater.processPaymentStatusUpdated(buildEvent({
    eventId: 'evt-redis-refresh-1',
    status: 'COMPLETED',
    amount: 75
  }));

  assert.equal(result.kind, 'applied');

  const sourceCache = await harness.redisClient.get('balance:acc-source-1');
  const destinationCache = await harness.redisClient.get('balance:acc-dest-1');

  assert.ok(sourceCache);
  assert.ok(destinationCache);
  assert.equal(harness.metrics.redisCacheRefreshSuccess, 2);
});

test('malformed event is handled safely', async () => {
  const harness = buildUpdater();

  const result = await harness.updater.processPaymentStatusUpdated({
    specVersion: '1.0',
    type: 'payment.status.updated.v1',
    version: 1,
    metadata: {
      eventId: 'evt-malformed',
      correlationId: 'corr-malformed',
      timestamp: new Date().toISOString(),
      producer: 'payment-orchestration'
    },
    payload: {
      paymentId: 'p1',
      sourceAccountId: 's1',
      destinationAccountId: 'd1',
      amount: 'bad',
      currency: 'USD',
      previousStatus: 'PROCESSING',
      status: 'COMPLETED',
      reason: 'ok'
    }
  });

  assert.equal(result.kind, 'invalid_event');
});

test('same source and destination account is handled safely', async () => {
  const harness = buildUpdater();

  const result = await harness.updater.processPaymentStatusUpdated(buildEvent({
    eventId: 'evt-same-account',
    status: 'COMPLETED',
    sourceAccountId: 'acc-same',
    destinationAccountId: 'acc-same',
    amount: 50
  }));

  assert.equal(result.kind, 'no_op_same_account');
  assert.equal(harness.dbClient.snapshots.size, 0);
});

test('currency mismatch fails safely', async () => {
  const harness = buildUpdater([
    {
      accountId: 'acc-source-1',
      availableBalance: 1000,
      ledgerBalance: 1000,
      currency: 'KHR',
      version: 1,
      updatedAt: '2026-04-13T00:00:00.000Z'
    }
  ]);

  const result = await harness.updater.processPaymentStatusUpdated(buildEvent({
    eventId: 'evt-currency-mismatch',
    status: 'COMPLETED',
    currency: 'USD'
  }));

  assert.equal(result.kind, 'currency_mismatch');
  if (result.kind === 'currency_mismatch') {
    assert.equal(result.reason, 'source_currency_mismatch');
  }
});
