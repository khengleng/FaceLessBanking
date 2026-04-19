# audit-service Runbook

## Purpose
- Central append-oriented audit event persistence and payment lifecycle audit enrichment.

## Dependencies
- Postgres adapter baseline (in-memory pattern currently)
- Kafka consumer for lifecycle enrichment
- Optional Kafka publish for hardened audit placeholder events

## Required Environment Variables
- `PORT` (optional, default `3000`)
- `HOST` (optional, default `0.0.0.0`)

## Ports
- Binds to `HOST:PORT`, default `0.0.0.0:3000`.

## Health Endpoint
- `GET /health`

## API Surface (Operational)
- `POST /audit/events`
- `GET /audit/events/:eventId`
- `GET /audit/events`

## Events Published
- `audit.hardened.recorded.v1` (placeholder path)

## Events Consumed
- `payment.initiated.v1`
- `payment.status.updated.v1`

## Startup Notes
- No update/delete audit APIs should be exposed.
- Ensure checksum placeholder generation remains enabled for new writes.

## Common Failure Modes
- Duplicate source event processing without idempotency marker.
- Unsafe payload fields accidentally persisted.
- Query endpoints degraded by missing indexes once real DB schema is introduced.
