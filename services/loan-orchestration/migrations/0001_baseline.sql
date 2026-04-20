-- Baseline migration finalized for domain schema.
-- Logic ensures tables are created with proper constraints and indexes.

BEGIN;

CREATE TABLE IF NOT EXISTS loans (
    loan_id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    principal_cents BIGINT NOT NULL,
    interest_rate_bps INT NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS repayments (
    repayment_id TEXT PRIMARY KEY,
    loan_account_id TEXT NOT NULL REFERENCES loans(loan_id),
    amount_cents BIGINT NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    repayment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS repayment_schedules (
    schedule_id TEXT PRIMARY KEY,
    loan_account_id TEXT NOT NULL REFERENCES loans(loan_id) UNIQUE,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS repayment_schedule_entries (
    entry_id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL REFERENCES repayment_schedules(schedule_id),
    due_date DATE NOT NULL,
    principal_due_cents BIGINT NOT NULL,
    interest_due_cents BIGINT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS disbursement_requests (
    disbursement_request_id TEXT PRIMARY KEY,
    loan_account_id TEXT NOT NULL REFERENCES loans(loan_id),
    source_account_id TEXT NOT NULL,
    destination_account_id TEXT NOT NULL,
    amount_cents BIGINT NOT NULL,
    currency TEXT NOT NULL,
    payment_id TEXT NOT NULL,
    correlation_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS loan_interest_accruals (
    accrual_id TEXT PRIMARY KEY,
    loan_account_id TEXT NOT NULL REFERENCES loans(loan_id),
    accrual_date DATE NOT NULL,
    accrual_mode TEXT NOT NULL,
    accrued_interest_cents BIGINT NOT NULL,
    principal_basis_cents BIGINT NOT NULL,
    annual_interest_rate DECIMAL(10, 5) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(loan_account_id, accrual_date, accrual_mode)
);

CREATE TABLE IF NOT EXISTS processed_events (
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id, event_type)
);

COMMIT;

