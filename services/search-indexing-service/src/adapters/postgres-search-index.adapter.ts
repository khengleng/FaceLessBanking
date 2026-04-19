import type {
  InvestigationIndexRecord,
  InvestigationSearchQuery
} from '../domain/investigation-index-record.js';

export type PostgresQueryResultRow = Record<string, unknown>;

export interface PostgresClient {
  query(
    text: string,
    params?: unknown[]
  ): Promise<{ rowCount: number | null; rows: PostgresQueryResultRow[] }>;
}

export class PostgresSearchIndexAdapter {
  constructor(private readonly db: PostgresClient) {}

  async upsertIndexRecord(record: InvestigationIndexRecord): Promise<void> {
    await this.db.query(
      `
        INSERT INTO investigation_index (
          index_id,
          entity_type,
          entity_id,
          correlation_id,
          customer_id,
          account_id,
          payment_id,
          case_id,
          status,
          searchable_text,
          source_event_id,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (entity_type, entity_id) DO UPDATE SET
          correlation_id = EXCLUDED.correlation_id,
          customer_id = EXCLUDED.customer_id,
          account_id = EXCLUDED.account_id,
          payment_id = EXCLUDED.payment_id,
          case_id = EXCLUDED.case_id,
          status = EXCLUDED.status,
          searchable_text = EXCLUDED.searchable_text,
          source_event_id = EXCLUDED.source_event_id,
          updated_at = EXCLUDED.updated_at
      `,
      [
        record.indexId,
        record.entityType,
        record.entityId,
        record.correlationId,
        record.customerId,
        record.accountId,
        record.paymentId,
        record.caseId,
        record.status,
        record.searchableText,
        record.sourceEventId,
        record.createdAt,
        record.updatedAt
      ]
    );
  }

  async hasProcessedIndexEvent(eventId: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT event_id FROM investigation_index_events WHERE event_id = $1',
      [eventId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  async markIndexEventProcessed(eventId: string): Promise<void> {
    await this.db.query(
      `
        INSERT INTO investigation_index_events (event_id, processed_at)
        VALUES ($1, $2)
        ON CONFLICT (event_id) DO NOTHING
      `,
      [eventId, new Date().toISOString()]
    );
  }

  async searchIndex(query: InvestigationSearchQuery): Promise<InvestigationIndexRecord[]> {
    const result = await this.db.query(
      `
        SELECT
          index_id,
          entity_type,
          entity_id,
          correlation_id,
          customer_id,
          account_id,
          payment_id,
          case_id,
          status,
          searchable_text,
          source_event_id,
          created_at,
          updated_at
        FROM investigation_index
        WHERE ($1::text IS NULL OR searchable_text ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR entity_type = $2)
          AND ($3::text IS NULL OR customer_id = $3)
          AND ($4::text IS NULL OR account_id = $4)
          AND ($5::text IS NULL OR payment_id = $5)
          AND ($6::text IS NULL OR case_id = $6)
          AND ($7::text IS NULL OR status = $7)
          AND ($8::text IS NULL OR correlation_id = $8)
        ORDER BY updated_at DESC
        LIMIT $9 OFFSET $10
      `,
      [
        query.q ?? null,
        query.entityType ?? null,
        query.customerId ?? null,
        query.accountId ?? null,
        query.paymentId ?? null,
        query.caseId ?? null,
        query.status ?? null,
        query.correlationId ?? null,
        query.limit,
        query.offset
      ]
    );

    return result.rows.map(toIndexRecord);
  }

  async getIndexRecordByEntity(
    entityType: InvestigationIndexRecord['entityType'],
    entityId: string
  ): Promise<InvestigationIndexRecord | null> {
    const result = await this.db.query(
      `
        SELECT
          index_id,
          entity_type,
          entity_id,
          correlation_id,
          customer_id,
          account_id,
          payment_id,
          case_id,
          status,
          searchable_text,
          source_event_id,
          created_at,
          updated_at
        FROM investigation_index
        WHERE entity_type = $1
          AND entity_id = $2
      `,
      [entityType, entityId]
    );

    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    return toIndexRecord(result.rows[0]);
  }
}

function toIndexRecord(row: PostgresQueryResultRow): InvestigationIndexRecord {
  return {
    indexId: String(row.index_id),
    entityType: String(row.entity_type) as InvestigationIndexRecord['entityType'],
    entityId: String(row.entity_id),
    correlationId: row.correlation_id ? String(row.correlation_id) : undefined,
    customerId: row.customer_id ? String(row.customer_id) : undefined,
    accountId: row.account_id ? String(row.account_id) : undefined,
    paymentId: row.payment_id ? String(row.payment_id) : undefined,
    caseId: row.case_id ? String(row.case_id) : undefined,
    status: row.status ? String(row.status) : undefined,
    searchableText: String(row.searchable_text),
    sourceEventId: String(row.source_event_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}
