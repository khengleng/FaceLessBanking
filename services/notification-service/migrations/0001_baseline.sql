-- Baseline migration finalized for notification-service domain schema.

BEGIN;

CREATE TABLE IF NOT EXISTS notification_requests (
    notification_id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    template_key TEXT NOT NULL,
    recipient TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    status TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    delivery_attempt_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE (event_id, template_key)
);

CREATE TABLE IF NOT EXISTS processed_notification_events (
    event_id TEXT PRIMARY KEY,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notification_requests(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notification_requests(created_at);

COMMIT;

