import type { PostgresSearchIndexAdapter } from '../adapters/postgres-search-index.adapter.js';
import {
  mapLifecycleEventToIndexRecord,
  parseLifecycleEvent
} from '../domain/lifecycle-event.js';
import type { SearchIndexingMetrics } from '../events/metrics.js';

export type ProcessLifecycleEventResult =
  | { kind: 'indexed' }
  | { kind: 'duplicate_event' }
  | { kind: 'ignored_event'; reason: string }
  | { kind: 'invalid_event'; reason: string };

export class SearchEventIndexerApplication {
  constructor(
    private readonly postgresAdapter: PostgresSearchIndexAdapter,
    private readonly metrics: SearchIndexingMetrics,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async processLifecycleEvent(rawEvent: unknown): Promise<ProcessLifecycleEventResult> {
    const event = parseLifecycleEvent(rawEvent);
    if (!event) {
      return { kind: 'invalid_event', reason: 'invalid_event_envelope' };
    }

    const { eventId, correlationId } = event.metadata;

    const processed = await this.postgresAdapter.hasProcessedIndexEvent(eventId);
    if (processed) {
      this.metrics.recordDuplicateIndexEventSkipped();
      this.logger.info({ eventId, correlationId }, 'Skipping duplicate search indexing event');
      return { kind: 'duplicate_event' };
    }

    const existing = await this.postgresAdapter.getIndexRecordByEntity(
      deriveEntityType(event.type),
      deriveEntityId(event.payload)
    );

    const mapped = mapLifecycleEventToIndexRecord(
      event,
      existing,
      new Date().toISOString()
    );

    if (!mapped) {
      await this.postgresAdapter.markIndexEventProcessed(eventId);
      this.logger.warn(
        { eventId, correlationId, eventType: event.type },
        'Ignoring lifecycle event with unsupported/missing indexable identifiers'
      );
      return { kind: 'ignored_event', reason: 'missing_indexable_fields' };
    }

    await this.postgresAdapter.upsertIndexRecord(mapped);
    await this.postgresAdapter.markIndexEventProcessed(eventId);

    this.metrics.recordIndexRecordUpserted();
    this.logger.info(
      {
        eventId,
        correlationId,
        eventType: event.type,
        entityType: mapped.entityType,
        entityId: mapped.entityId
      },
      'Upserted investigation index record from lifecycle event'
    );

    return { kind: 'indexed' };
  }
}

function deriveEntityType(eventType: string): 'CUSTOMER' | 'ACCOUNT' | 'PAYMENT' | 'ONBOARDING_CASE' {
  if (eventType.startsWith('customer.')) {
    return 'CUSTOMER';
  }

  if (eventType.startsWith('account.')) {
    return 'ACCOUNT';
  }

  if (eventType.startsWith('payment.')) {
    return 'PAYMENT';
  }

  return 'ONBOARDING_CASE';
}

function deriveEntityId(payload: Record<string, unknown>): string {
  const values = [payload.customerId, payload.accountId, payload.paymentId, payload.caseId];
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return '__unresolved__';
}
