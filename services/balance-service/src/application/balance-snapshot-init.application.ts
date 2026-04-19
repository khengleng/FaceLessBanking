import type { PostgresBalanceProjectionAdapter } from '../adapters/postgres-balance-projection.adapter.js';
import type { RedisBalanceAdapter } from '../adapters/redis-balance.adapter.js';
import {
  BALANCE_SNAPSHOT_INIT_STAGE,
  parseAccountActivatedEvent
} from '../domain/account-activated-event.js';
import { buildInitialBalanceSnapshot } from '../domain/balance.js';
import type { BalanceMetrics } from '../events/metrics.js';

export type SnapshotInitResult =
  | { kind: 'created' }
  | { kind: 'duplicate_event' }
  | { kind: 'already_exists' }
  | { kind: 'invalid_event'; reason: string };

export class BalanceSnapshotInitApplication {
  constructor(
    private readonly postgresAdapter: PostgresBalanceProjectionAdapter,
    private readonly redisAdapter: RedisBalanceAdapter,
    private readonly metrics: BalanceMetrics,
    private readonly cacheTtlSeconds: number,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    },
    private readonly defaultCurrency: string
  ) {}

  async processAccountActivated(rawEvent: unknown): Promise<SnapshotInitResult> {
    const event = parseAccountActivatedEvent(rawEvent);
    if (!event) {
      return { kind: 'invalid_event', reason: 'invalid_event_envelope' };
    }

    const { eventId, correlationId, timestamp } = event.metadata;
    const accountId = event.payload.accountId;

    const alreadyProcessed = await this.postgresAdapter.hasProcessedSnapshotInitEvent(eventId);
    if (alreadyProcessed) {
      this.metrics.recordDuplicateSnapshotInitEventSkipped();
      this.logger.info(
        { eventId, correlationId, stage: BALANCE_SNAPSHOT_INIT_STAGE },
        'Skipping duplicate balance snapshot init event'
      );
      return { kind: 'duplicate_event' };
    }

    const current = await this.postgresAdapter.getBalanceSnapshot(accountId);
    if (current) {
      await this.postgresAdapter.markSnapshotInitEventProcessed(eventId);
      this.logger.info(
        { eventId, correlationId, accountId },
        'Skipping default snapshot creation because snapshot already exists'
      );
      return { kind: 'already_exists' };
    }

    const snapshot = buildInitialBalanceSnapshot({
      accountId,
      currency: event.payload.currency ?? this.defaultCurrency,
      updatedAt: timestamp,
      sourceEventId: eventId
    });

    await this.postgresAdapter.createBalanceSnapshot(snapshot);

    try {
      await this.redisAdapter.setBalanceSnapshot(snapshot, this.cacheTtlSeconds);
      this.metrics.recordRedisCacheRefreshSuccess();
    } catch (error: unknown) {
      this.metrics.recordRedisCacheRefreshFailure();
      this.logger.warn(
        { eventId, correlationId, accountId, error },
        'Failed to warm Redis cache for initialized balance snapshot'
      );
    }

    await this.postgresAdapter.markSnapshotInitEventProcessed(eventId);
    this.metrics.recordDefaultBalanceSnapshotCreated();

    this.logger.info(
      { eventId, correlationId, accountId },
      'Created default balance snapshot for activated account'
    );

    return { kind: 'created' };
  }
}
