-- accounting-service baseline schema inferred from current SQL adapter usage.

BEGIN;

CREATE TABLE IF NOT EXISTS journal_entries (
  journal_id TEXT PRIMARY KEY,
  source_event_id TEXT,
  source_event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  total_debit NUMERIC(20,2) NOT NULL,
  total_credit NUMERIC(20,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_lines (
  line_id TEXT PRIMARY KEY,
  journal_id TEXT NOT NULL REFERENCES journal_entries(journal_id),
  account_code TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  amount NUMERIC(20,2) NOT NULL,
  currency TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS processed_accounting_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL
);

COMMIT;
