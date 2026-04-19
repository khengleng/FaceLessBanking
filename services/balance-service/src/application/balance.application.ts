import type { RedisBalanceAdapter } from '../adapters/redis-balance.adapter.js';
import type { PostgresBalanceProjectionAdapter } from '../adapters/postgres-balance-projection.adapter.js';
import type { BalanceSnapshot } from '../domain/balance.js';
import type { BalanceProjectionEvent } from '../domain/balance-projection-event.js';
import type { BalanceMetrics } from '../events/metrics.js';
import type { BalanceEventsPublisher } from '../events/balance.events.js';

export type GetBalanceResult =
  | { kind: 'found'; snapshot: BalanceSnapshot; source: 'redis' | 'postgres' }
  | { kind: 'not_found' };

export type ApplyProjectionResult =
  | { kind: 'applied'; snapshot: BalanceSnapshot }
  | { kind: 'duplicate_event' }
  | { kind: 'stale_event'; currentVersion: number };

export class BalanceApplication {
  constructor(
    private readonly redisAdapter: RedisBalanceAdapter,
    private readonly postgresAdapter: PostgresBalanceProjectionAdapter,
    private readonly metrics: BalanceMetrics,
    private readonly eventsPublisher: BalanceEventsPublisher,
    private readonly cacheTtlSeconds: number
  ) {}

  async getBalance(accountId: string): Promise<GetBalanceResult> {
    const fromRedis = await this.redisAdapter.getBalanceSnapshot(accountId);
    if (fromRedis) {
      this.metrics.recordCacheHit();
      return { kind: 'found', snapshot: fromRedis, source: 'redis' };
    }

    this.metrics.recordCacheMiss();

    const fromPostgres = await this.postgresAdapter.getBalanceSnapshot(accountId);
    if (!fromPostgres) {
      return { kind: 'not_found' };
    }

    await this.redisAdapter.setBalanceSnapshot(fromPostgres, this.cacheTtlSeconds);

    return { kind: 'found', snapshot: fromPostgres, source: 'postgres' };
  }

  async applyProjectionEvent(event: BalanceProjectionEvent): Promise<ApplyProjectionResult> {
    const alreadyProcessed = await this.postgresAdapter.hasProcessedEvent(event.eventId);
    if (alreadyProcessed) {
      return { kind: 'duplicate_event' };
    }

    const current = await this.postgresAdapter.getBalanceSnapshot(event.accountId);

    if (current && new Date(event.timestamp).getTime() < new Date(current.updatedAt).getTime()) {
      return { kind: 'stale_event', currentVersion: current.version };
    }

    const snapshot = buildNextSnapshot(current, event);

    await this.postgresAdapter.upsertBalanceProjection(snapshot);
    await this.redisAdapter.setBalanceSnapshot(snapshot, this.cacheTtlSeconds);
    await this.postgresAdapter.markEventProcessed(event.eventId);

    this.metrics.recordProjectionUpdate();
    await this.eventsPublisher.emitProjectionApplied(event);

    return { kind: 'applied', snapshot };
  }
}

function buildNextSnapshot(
  current: BalanceSnapshot | null,
  event: BalanceProjectionEvent
): BalanceSnapshot {
  const availableBalance = event.resultingAvailableBalance
    ?? (current?.availableBalance ?? 0) + event.deltaAmount;

  const ledgerBalance = event.resultingLedgerBalance
    ?? (current?.ledgerBalance ?? 0) + event.deltaAmount;

  return {
    accountId: event.accountId,
    availableBalance,
    ledgerBalance,
    currency: event.currency,
    version: (current?.version ?? 0) + 1,
    updatedAt: event.timestamp
  };
}
