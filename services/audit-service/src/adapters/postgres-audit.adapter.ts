import pg from 'pg';
const { Pool } = pg;

import type { AuditEvent } from '../domain/audit-event.js';

export class ImmutableAuditLogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImmutableAuditLogError';
  }
}

export class PostgresAuditAdapter {
  private readonly pool: pg.Pool;

  constructor(pool?: pg.Pool) {
    this.pool = pool ?? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async createAuditEvent(event: AuditEvent): Promise<void> {
    try {
      const query = `
        INSERT INTO audit_events (
          audit_id, source_event_id, event_type, correlation_id, 
          entity_type, entity_id, payload, checksum, actor, 
          ledger_anchor_hash, ledger_anchor_tx_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;
      const values = [
        event.auditId,
        event.sourceEventId,
        event.eventType,
        event.correlationId,
        event.entityType,
        event.entityId,
        JSON.stringify(event.payload),
        event.checksum,
        event.actor ? JSON.stringify(event.actor) : null,
        event.ledgerAnchorHash ?? null,
        event.ledgerAnchorTxId ?? null,
        event.createdAt
      ];

      await this.pool.query(query, values);
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        throw new ImmutableAuditLogError(
          `Audit event with auditId or sourceEventId matching "${event.auditId}"/"${event.sourceEventId}" already exists and cannot be overwritten`
        );
      }
      throw error;
    }
  }

  async findEventById(eventId: string): Promise<AuditEvent | null> {
    const query = 'SELECT * FROM audit_events WHERE audit_id = $1';
    const { rows } = await this.pool.query(query, [eventId]);
    
    if (rows.length === 0) {
      return null;
    }

    return this.mapRowToEvent(rows[0]);
  }

  async findAuditBySourceEventId(sourceEventId: string): Promise<AuditEvent | null> {
    const query = 'SELECT * FROM audit_events WHERE source_event_id = $1';
    const { rows } = await this.pool.query(query, [sourceEventId]);
    
    if (rows.length === 0) {
      return null;
    }

    return this.mapRowToEvent(rows[0]);
  }

  async getAuditByEntityId(entityType: string, entityId: string): Promise<AuditEvent[]> {
    const query = 'SELECT * FROM audit_events WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at ASC';
    const { rows } = await this.pool.query(query, [entityType, entityId]);
    return rows.map(row => this.mapRowToEvent(row));
  }

  async getAuditByCorrelationId(correlationId: string): Promise<AuditEvent[]> {
    const query = 'SELECT * FROM audit_events WHERE correlation_id = $1 ORDER BY created_at ASC';
    const { rows } = await this.pool.query(query, [correlationId]);
    return rows.map(row => this.mapRowToEvent(row));
  }

  async getAuditBySourceEventId(sourceEventId: string): Promise<AuditEvent[]> {
    const event = await this.findAuditBySourceEventId(sourceEventId);
    return event ? [event] : [];
  }

  async appendEvent(event: AuditEvent): Promise<void> {
    await this.createAuditEvent(event);
  }

  async findEventsByEntity(entityType: string, entityId: string): Promise<AuditEvent[]> {
    return this.getAuditByEntityId(entityType, entityId);
  }

  private mapRowToEvent(row: any): AuditEvent {
    return {
      auditId: row.audit_id,
      sourceEventId: row.source_event_id,
      eventId: row.audit_id, // Backward-compatible alias
      eventType: row.event_type,
      correlationId: row.correlation_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      payload: row.payload,
      checksum: row.checksum,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      timestamp: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at, // Backward-compatible alias
      actor: row.actor,
      ledgerAnchorHash: row.ledger_anchor_hash ?? undefined,
      ledgerAnchorTxId: row.ledger_anchor_tx_id ?? undefined,
    };
  }
}
