# account-service Runbook

## Purpose
- Owns internal account records, activation, and account query endpoints.

## Dependencies
- Current adapter baseline is in-memory for account state.
- Kafka producers/consumers for account/customer lifecycle events.

## Required Environment Variables
- `PORT` (optional, default `3000`)
- `HOST` (optional, default `0.0.0.0`)

## Ports
- Binds to `HOST:PORT`, default `0.0.0.0:3000`.

## Health Endpoint
- `GET /health`

## API Surface (Operational)
- `POST /accounts`
- `GET /accounts`
- `GET /accounts/:accountId`
- `GET /accounts/:accountId/balance`
- `POST /accounts/:accountId/activate`
- `POST /accounts/interest/accrue`

## Events Published
- `account.created.v1`
- `account.activated.v1`
- `deposit.interest.accrued.v1`

## Events Consumed
- `customer.created.v1`
- `account.created.v1` (activation flow)

## Startup Notes
- Keep idempotent consumer handling enabled before high-volume replay.
- This service is canonical owner vs legacy aliases (see naming doc).

## Common Failure Modes
- Duplicate consumer event replay.
- Invalid status transition on activation.
- Upstream customer event without resolvable reference.
