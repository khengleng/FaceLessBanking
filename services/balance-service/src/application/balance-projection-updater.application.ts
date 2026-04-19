import type { PostgresBalanceProjectionAdapter } from '../adapters/postgres-balance-projection.adapter.js';
import type { RedisBalanceAdapter } from '../adapters/redis-balance.adapter.js';
import type { BalanceSnapshot } from '../domain/balance.js';
import {
  BALANCE_PROJECTION_STAGE,
  type PaymentStatusUpdatedEvent
} from '../domain/payment-status-updated-event.js';
import type { BalanceMetrics } from '../events/metrics.js';

export type ProjectionUpdaterResult =
  | { kind: 'applied'; source: BalanceSnapshot; destination: BalanceSnapshot }
  | { kind: 'duplicate_event' }
  | { kind: 'ignored_status'; status: string }
  | { kind: 'invalid_event'; reason: string }
  | { kind: 'currency_mismatch'; reason: string }
  | { kind: 'no_op_same_account' };

export class BalanceProjectionUpdaterApplication {
  constructor(
    private readonly postgresAdapter: PostgresBalanceProjectionAdapter,
    private readonly redisAdapter: RedisBalanceAdapter,
    private readonly metrics: BalanceMetrics,
    private readonly cacheTtlSeconds: number,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async processPaymentStatusUpdated(rawEvent: unknown): Promise<ProjectionUpdaterResult> {
    const event = parsePaymentStatusEvent(rawEvent);
    if (!event) {
      return { kind: 'invalid_event', reason: 'invalid_event_envelope' };
    }

    const { eventId, correlationId } = event.metadata;

    const alreadyProcessed = await this.postgresAdapter.hasProcessedProjectionEvent(eventId);
    if (alreadyProcessed) {
      this.metrics.recordDuplicateProjectionEventSkipped();
      this.logger.info({ eventId, correlationId }, 'Skipping duplicate projection event');
      return { kind: 'duplicate_event' };
    }

    const status = event.payload.status;
    if (status !== 'COMPLETED') {
      await this.postgresAdapter.markProjectionEventProcessed(eventId);
      this.logger.info({ eventId, correlationId, status }, 'Ignoring non-mutating payment status event');
      return { kind: 'ignored_status', status };
    }

    if (event.payload.sourceAccountId === event.payload.destinationAccountId) {
      await this.postgresAdapter.markProjectionEventProcessed(eventId);
      this.logger.warn(
        { eventId, correlationId, accountId: event.payload.sourceAccountId },
        'Skipping projection mutation for same source and destination account'
      );
      return { kind: 'no_op_same_account' };
    }

    const sourceCurrent = await this.postgresAdapter.getBalanceSnapshot(event.payload.sourceAccountId);
    const destinationCurrent = await this.postgresAdapter.getBalanceSnapshot(event.payload.destinationAccountId);

    if (!validateCurrency(sourceCurrent, event.payload.currency)) {
      this.logger.error({ eventId, correlationId }, 'Source currency mismatch in projection update');
      return { kind: 'currency_mismatch', reason: 'source_currency_mismatch' };
    }

    if (!validateCurrency(destinationCurrent, event.payload.currency)) {
      this.logger.error({ eventId, correlationId }, 'Destination currency mismatch in projection update');
      return { kind: 'currency_mismatch', reason: 'destination_currency_mismatch' };
    }

    // TODO: replace zero-baseline initialization with core-banking synchronized baseline.
    const sourceNext = buildNextSnapshot(
      sourceCurrent,
      event.payload.sourceAccountId,
      -event.payload.amount,
      event.payload.currency,
      event.metadata.timestamp
    );

    const destinationNext = buildNextSnapshot(
      destinationCurrent,
      event.payload.destinationAccountId,
      event.payload.amount,
      event.payload.currency,
      event.metadata.timestamp
    );

    await this.postgresAdapter.upsertBalanceProjection(sourceNext);
    await this.postgresAdapter.upsertBalanceProjection(destinationNext);

    await this.redisAdapter.setBalanceSnapshot(sourceNext, this.cacheTtlSeconds);
    this.metrics.recordRedisCacheRefreshSuccess();
    await this.redisAdapter.setBalanceSnapshot(destinationNext, this.cacheTtlSeconds);
    this.metrics.recordRedisCacheRefreshSuccess();

    await this.postgresAdapter.markProjectionEventProcessed(eventId);
    this.metrics.recordProjectionUpdateApplied();

    this.logger.info(
      {
        eventId,
        correlationId,
        sourceAccountId: sourceNext.accountId,
        destinationAccountId: destinationNext.accountId,
        amount: event.payload.amount
      },
      'Applied balance projection update for completed payment'
    );

    return {
      kind: 'applied',
      source: sourceNext,
      destination: destinationNext
    };
  }
}

function parsePaymentStatusEvent(rawEvent: unknown): PaymentStatusUpdatedEvent | null {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null;
  }

  const event = rawEvent as Record<string, unknown>;

  if (event.specVersion !== '1.0' || event.type !== 'payment.status.updated.v1') {
    return null;
  }

  if (typeof event.version !== 'number') {
    return null;
  }

  const metadata = event.metadata as Record<string, unknown> | undefined;
  const payload = event.payload as Record<string, unknown> | undefined;

  if (!metadata || !payload) {
    return null;
  }

  if (
    typeof metadata.eventId !== 'string'
    || typeof metadata.correlationId !== 'string'
    || typeof metadata.timestamp !== 'string'
    || typeof metadata.producer !== 'string'
  ) {
    return null;
  }

  if (
    typeof payload.paymentId !== 'string'
    || typeof payload.sourceAccountId !== 'string'
    || typeof payload.destinationAccountId !== 'string'
    || typeof payload.amount !== 'number'
    || typeof payload.currency !== 'string'
    || typeof payload.previousStatus !== 'string'
    || typeof payload.status !== 'string'
    || typeof payload.reason !== 'string'
  ) {
    return null;
  }

  return event as PaymentStatusUpdatedEvent;
}

function buildNextSnapshot(
  current: BalanceSnapshot | null,
  accountId: string,
  delta: number,
  currency: string,
  updatedAt: string
): BalanceSnapshot {
  return {
    accountId,
    availableBalance: (current?.availableBalance ?? 0) + delta,
    ledgerBalance: (current?.ledgerBalance ?? 0) + delta,
    currency,
    version: (current?.version ?? 0) + 1,
    updatedAt
  };
}

function validateCurrency(snapshot: BalanceSnapshot | null, currency: string): boolean {
  if (!snapshot) {
    return true;
  }

  return snapshot.currency === currency;
}

export function projectionConsumerStage(): string {
  return BALANCE_PROJECTION_STAGE;
}
