-- balance-service baseline schema inferred from current SQL adapter usage.

BEGIN;

CREATE TABLE IF NOT EXISTS balance_projections (
  account_id TEXT PRIMARY KEY,
  available_balance NUMERIC(20,2) NOT NULL,
  ledger_balance NUMERIC(20,2) NOT NULL,
  currency TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS balance_projection_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL
);

COMMIT;
