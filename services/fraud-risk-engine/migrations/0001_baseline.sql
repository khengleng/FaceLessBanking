-- Baseline migration finalized for fraud-risk-engine domain schema.

BEGIN;

CREATE TABLE IF NOT EXISTS risk_alerts (
    alert_id TEXT PRIMARY KEY,
    risk_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_risk_alerts_entity ON risk_alerts(entity_id);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_status ON risk_alerts(status);

COMMIT;

