# balance-service Runbook

## Purpose
- Provides high-TPS balance reads using Redis-first and projection fallback.

## Dependencies
- PostgreSQL projection store
- Redis cache
- Kafka consumers for projection updates and snapshot init

## Required Environment Variables
- `DATABASE_URL` (required)
- `PORT` (optional, default `3000`)
- `HOST` (optional, default `0.0.0.0`)
- `LOG_LEVEL` (optional, default `info`)
- `REDIS_URL` (optional in local, default `redis://localhost:6379`)
- `BALANCE_CACHE_TTL_SECONDS` (optional, default `60`)
- `BALANCE_CACHE_KEY_PREFIX` (optional, default `balance:`)

## Ports
- Binds to `HOST:PORT`, default `0.0.0.0:3000`.

## Health Endpoint
- `GET /health`

## API Surface (Operational)
- `GET /balances/:accountId`
- `POST /balances/events/apply` (internal)

## Events Published
- None in current baseline (publisher placeholder exists).

## Events Consumed
- `payment.status.updated.v1`
- `account.activated.v1`

## Startup Notes
- Ensure Redis and Postgres are both reachable before exposing traffic.
- Projection consumers should be started to keep reads current.

## Common Failure Modes
- Redis miss + Postgres miss returns not found.
- Currency mismatch in projection event handling.
- Duplicate event application if processed-event tracking fails.
