-- Baseline migration finalized for domain schema.
-- Logic ensures tables are created with proper constraints and indexes.

BEGIN;

CREATE TABLE IF NOT EXISTS ledger_anchors (
    anchor_id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL UNIQUE,
    hash TEXT NOT NULL,
    chain TEXT NOT NULL,
    status TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_anchors_event_id ON ledger_anchors(event_id);

COMMIT;

