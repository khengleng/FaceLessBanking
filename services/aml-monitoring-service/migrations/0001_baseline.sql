-- Baseline migration finalized for aml-monitoring-service domain schema.

BEGIN;

CREATE TABLE IF NOT EXISTS aml_alerts (
    alert_id TEXT PRIMARY KEY,
    source_event_id TEXT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS processed_aml_events (
    event_id TEXT PRIMARY KEY,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aml_transaction_history (
    id SERIAL PRIMARY KEY,
    source_account_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aml_tx_history_created_at ON aml_transaction_history(created_at);
CREATE INDEX IF NOT EXISTS idx_aml_tx_history_accounts ON aml_transaction_history(source_account_id, customer_id);

COMMIT;

