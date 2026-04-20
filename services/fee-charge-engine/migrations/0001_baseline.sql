-- Baseline migration finalized for domain schema.
-- Logic ensures tables are created with proper constraints and indexes.

BEGIN;

CREATE TABLE IF NOT EXISTS fee_rules (
    rule_id TEXT PRIMARY KEY,
    rule_type TEXT NOT NULL,
    trigger_event_type TEXT NOT NULL,
    fixed_amount_cents BIGINT,
    percentage DECIMAL(10, 5),
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fee_rules_trigger ON fee_rules(trigger_event_type, status);

CREATE TABLE IF NOT EXISTS fee_assessments (
    assessment_id TEXT PRIMARY KEY,
    source_event_id TEXT NOT NULL,
    source_entity_type TEXT NOT NULL,
    source_entity_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    rule_id TEXT NOT NULL REFERENCES fee_rules(rule_id),
    assessed_amount_cents BIGINT NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    payment_id TEXT,
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fee_assessments_source ON fee_assessments(source_event_id);
CREATE INDEX IF NOT EXISTS idx_fee_assessments_customer ON fee_assessments(customer_id);

CREATE TABLE IF NOT EXISTS processed_events (
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id, event_type)
);

COMMIT;

