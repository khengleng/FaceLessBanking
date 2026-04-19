-- search-indexing-service baseline schema inferred from current SQL adapter usage.

BEGIN;

CREATE TABLE IF NOT EXISTS investigation_index (
  index_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  correlation_id TEXT,
  customer_id TEXT,
  account_id TEXT,
  payment_id TEXT,
  case_id TEXT,
  status TEXT,
  searchable_text TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS investigation_index_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL
);

COMMIT;
