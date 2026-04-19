import assert from 'node:assert/strict';
import test from 'node:test';

import { PostgresBalanceProjectionAdapter } from '../adapters/postgres-balance-projection.adapter.js';
import { RedisBalanceAdapter } from '../adapters/redis-balance.adapter.js';
import { BalanceSnapshotInitApplication } from '../application/balance-snapshot-init.application.js';
import type { BalanceSnapshot } from '../domain/balance.js';
import { BalanceMetrics } from '../events/metrics.js';

function createMockDb(initialSnapshots: BalanceSnapshot[] = []) {
  const snapshots = new Map<string, BalanceSnapshot>();
  for (const snapshot of initialSnapshots) {
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

function createSnapshotInitHarness(initialSnapshots: BalanceSnapshot[] = []) {
  const dbClient = createMockDb(initialSnapshots);
  const redisClient = createMockRedis();
  const postgresAdapter = new PostgresBalanceProjectionAdapter(dbClient);
  const redisAdapter = new RedisBalanceAdapter(redisClient, {
    keyPrefix: 'balance:',
    ttlSeconds: 120
  });
  const metrics = new BalanceMetrics();

  const application = new BalanceSnapshotInitApplication(
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
    },
    'USD'
  );

  return {
    application,
    dbClient,
    redisClient,
    metrics
  };
}

function buildAccountActivatedEvent(input: {
  eventId: string;
  accountId: string;
  correlationId?: string;
  currency?: string;
}) {
  return {
    specVersion: '1.0',
    type: 'account.activated.v1',
    version: 1,
    metadata: {
      eventId: input.eventId,
      correlationId: input.correlationId ?? 'corr-snapshot-init',
      timestamp: new Date().toISOString(),
      producer: 'account-service'
    },
    payload: {
      accountId: input.accountId,
      currency: input.currency
    }
  };
}

test('account.activated.v1 creates zero balance snapshot', async () => {
  const harness = createSnapshotInitHarness();

  const result = await harness.application.processAccountActivated(buildAccountActivatedEvent({
    eventId: 'evt-account-activated-1',
    accountId: 'acc-1',
    currency: 'KHR'
  }));

  assert.equal(result.kind, 'created');

  const snapshot = harness.dbClient.snapshots.get('acc-1');
  assert.ok(snapshot);
  assert.equal(snapshot?.availableBalance, 0);
  assert.equal(snapshot?.ledgerBalance, 0);
  assert.equal(snapshot?.currency, 'KHR');
  assert.equal(snapshot?.version, 1);
  assert.equal(harness.metrics.defaultBalanceSnapshotsCreated, 1);
});

test('Redis cache is warmed after snapshot creation', async () => {
  const harness = createSnapshotInitHarness();

  const result = await harness.application.processAccountActivated(buildAccountActivatedEvent({
    eventId: 'evt-account-activated-2',
    accountId: 'acc-2'
  }));

  assert.equal(result.kind, 'created');

  const cached = await harness.redisClient.get('balance:acc-2');
  assert.ok(cached);
  const parsed = JSON.parse(cached ?? '{}') as BalanceSnapshot;
  assert.equal(parsed.accountId, 'acc-2');
  assert.equal(parsed.availableBalance, 0);
  assert.equal(harness.metrics.redisCacheRefreshSuccess, 1);
});

test('duplicate activation event does not create duplicate snapshot', async () => {
  const harness = createSnapshotInitHarness();
  const event = buildAccountActivatedEvent({
    eventId: 'evt-account-activated-dup',
    accountId: 'acc-dup'
  });

  const first = await harness.application.processAccountActivated(event);
  assert.equal(first.kind, 'created');
  assert.equal(harness.dbClient.snapshots.size, 1);

  const second = await harness.application.processAccountActivated(event);
  assert.equal(second.kind, 'duplicate_event');
  assert.equal(harness.dbClient.snapshots.size, 1);
  assert.equal(harness.metrics.duplicateSnapshotInitEventsSkipped, 1);
});

test('existing snapshot is skipped safely', async () => {
  const harness = createSnapshotInitHarness([
    {
      accountId: 'acc-existing',
      availableBalance: 35,
      ledgerBalance: 35,
      currency: 'USD',
      version: 2,
      updatedAt: '2026-04-13T00:00:00.000Z'
    }
  ]);

  const result = await harness.application.processAccountActivated(buildAccountActivatedEvent({
    eventId: 'evt-account-activated-existing',
    accountId: 'acc-existing'
  }));

  assert.equal(result.kind, 'already_exists');
  assert.equal(harness.dbClient.snapshots.size, 1);
  assert.equal(harness.metrics.defaultBalanceSnapshotsCreated, 0);
});

test('malformed event is handled safely', async () => {
  const harness = createSnapshotInitHarness();

  const result = await harness.application.processAccountActivated({
    specVersion: '1.0',
    type: 'account.activated.v1',
    version: 1,
    metadata: {
      eventId: 'evt-account-activated-malformed',
      correlationId: 'corr-snapshot-malformed',
      timestamp: new Date().toISOString(),
      producer: 'account-service'
    },
    payload: {
      accountId: 123
    }
  });

  assert.equal(result.kind, 'invalid_event');
  assert.equal(harness.dbClient.snapshots.size, 0);
});
