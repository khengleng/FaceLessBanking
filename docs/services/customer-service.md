# customer-service Runbook

## Purpose
- Owns customer records and safe customer profile enrichment.

## Dependencies
- PostgreSQL (`customers`, `customer_profiles`, processed-event tables)
- Redis (idempotency path)
- Kafka (customer/profile events)

## Required Environment Variables
- `DATABASE_URL` (required)
- `PORT` (optional, default `3000`)
- `HOST` (optional, default `0.0.0.0`)
- `REDIS_URL` (optional in local, default `redis://localhost:6379`)

## Ports
- Binds to `HOST:PORT`, default `0.0.0.0:3000`.

## Health Endpoint
- `GET /health`

## API Surface (Operational)
- `POST /customers`
- `GET /customers`
- `GET /customers/:customerId`
- `GET /customers/:customerId/profile`
- `PATCH /customers/:customerId/profile`

## Events Published
- `customer.created.v1`
- `customer.profile.enriched.v1`
- Audit placeholder events (`audit.customer.*.v1`)

## Events Consumed
- `ekyc.status.updated.v1`
- `case.action.recorded.v1`

## Startup Notes
- Ensure DB schema baseline exists before startup.
- Consumer startup should be after Kafka broker availability.

## Common Failure Modes
- Duplicate idempotency key conflicts.
- DB schema mismatch for customer/profile tables.
- Malformed onboarding events skipped/rejected.
