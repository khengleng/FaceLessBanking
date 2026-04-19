import type { PostgresSearchIndexAdapter } from '../adapters/postgres-search-index.adapter.js';
import {
  INVESTIGATION_ENTITY_TYPES,
  type InvestigationEntityType,
  type InvestigationIndexRecord,
  type InvestigationSearchQuery
} from '../domain/investigation-index-record.js';
import type { SearchIndexingMetrics } from '../events/metrics.js';

export type SearchResult =
  | { kind: 'ok'; items: InvestigationIndexRecord[]; limit: number; offset: number }
  | { kind: 'invalid_query'; errors: string[] };

export type GetByEntityResult =
  | { kind: 'found'; item: InvestigationIndexRecord }
  | { kind: 'not_found' }
  | { kind: 'invalid_query'; errors: string[] };

export class SearchIndexingApplication {
  constructor(
    private readonly postgresAdapter: PostgresSearchIndexAdapter,
    private readonly metrics: SearchIndexingMetrics
  ) {}

  async search(query: {
    q?: string;
    entityType?: string;
    customerId?: string;
    accountId?: string;
    paymentId?: string;
    caseId?: string;
    status?: string;
    correlationId?: string;
    limit?: number;
    offset?: number;
  }): Promise<SearchResult> {
    const errors: string[] = [];
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      errors.push('limit must be an integer between 1 and 200');
    }

    if (!Number.isInteger(offset) || offset < 0) {
      errors.push('offset must be a non-negative integer');
    }

    if (query.entityType && !INVESTIGATION_ENTITY_TYPES.includes(query.entityType as InvestigationEntityType)) {
      errors.push(`entityType must be one of: ${INVESTIGATION_ENTITY_TYPES.join(', ')}`);
    }

    if (errors.length > 0) {
      return { kind: 'invalid_query', errors };
    }

    const result = await this.postgresAdapter.searchIndex({
      q: query.q,
      entityType: query.entityType as InvestigationEntityType | undefined,
      customerId: query.customerId,
      accountId: query.accountId,
      paymentId: query.paymentId,
      caseId: query.caseId,
      status: query.status,
      correlationId: query.correlationId,
      limit,
      offset
    } satisfies InvestigationSearchQuery);

    this.metrics.recordSearchQueryExecuted();

    return {
      kind: 'ok',
      items: result,
      limit,
      offset
    };
  }

  async getByEntity(entityType: string, entityId: string): Promise<GetByEntityResult> {
    const errors: string[] = [];

    if (!INVESTIGATION_ENTITY_TYPES.includes(entityType as InvestigationEntityType)) {
      errors.push(`entityType must be one of: ${INVESTIGATION_ENTITY_TYPES.join(', ')}`);
    }

    if (typeof entityId !== 'string' || entityId.trim().length === 0) {
      errors.push('entityId is required');
    }

    if (errors.length > 0) {
      return { kind: 'invalid_query', errors };
    }

    const item = await this.postgresAdapter.getIndexRecordByEntity(
      entityType as InvestigationEntityType,
      entityId
    );

    if (!item) {
      return { kind: 'not_found' };
    }

    return { kind: 'found', item };
  }
}
