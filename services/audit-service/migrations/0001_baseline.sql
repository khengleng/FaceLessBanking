-- Baseline migration finalized for domain schema.
-- Logic ensures tables are created with proper constraints and indexes.

BEGIN;

CREATE TABLE IF NOT EXISTS audit_events (
    audit_id TEXT PRIMARY KEY,
    source_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    correlation_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    checksum TEXT NOT NULL,
    actor JSONB,
    ledger_anchor_hash TEXT,
    ledger_anchor_tx_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_source_event ON audit_events(source_event_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_correlation ON audit_events(correlation_id);

COMMIT;

