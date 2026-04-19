-- customer-service baseline schema inferred from current SQL adapter usage.

BEGIN;

CREATE TABLE IF NOT EXISTS customers (
  customer_id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT,
  date_of_birth TEXT,
  onboarding_reference TEXT,
  source_entity_id TEXT,
  provider_reference TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_profiles (
  customer_id TEXT PRIMARY KEY REFERENCES customers(customer_id),
  display_name TEXT,
  onboarding_reference TEXT,
  verification_status TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  country_code TEXT,
  contact_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS processed_customer_creation_events (
  source_event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS processed_customer_profile_events (
  source_event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL
);

COMMIT;
