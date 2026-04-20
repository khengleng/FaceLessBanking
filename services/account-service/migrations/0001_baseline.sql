-- Baseline migration finalized for domain schema.
-- Logic ensures tables are created with proper constraints and indexes.

BEGIN;

CREATE TABLE IF NOT EXISTS accounts (
    account_id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    onboarding_reference TEXT,
    source_event_id TEXT,
    account_type TEXT,
    product_code TEXT NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    external_account_id TEXT NOT NULL,
    available_balance_cents BIGINT NOT NULL DEFAULT 0,
    ledger_balance_cents BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_accounts_customer_id ON accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_accounts_onboarding_ref ON accounts(onboarding_reference);

CREATE TABLE IF NOT EXISTS deposit_interest_accruals (
    accrual_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(account_id),
    accrual_date DATE NOT NULL,
    principal_basis_cents BIGINT NOT NULL,
    annual_interest_rate DECIMAL(10, 5) NOT NULL,
    accrued_interest_cents BIGINT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(account_id, accrual_date)
);

CREATE TABLE IF NOT EXISTS processed_events (
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id, event_type)
);

COMMIT;

