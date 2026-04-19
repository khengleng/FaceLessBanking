# payment-orchestration Runbook

## Purpose
- Handles internal transfer initiation and async payment state progression.

## Dependencies
- PostgreSQL adapter (payment persistence model)
- Redis adapter (idempotency pattern)
- Kafka producer/consumer for lifecycle events

## Required Environment Variables
- `PORT` (optional, default `3000`)
- `HOST` (optional, default `0.0.0.0`)
- `LOG_LEVEL` (optional, default `info`)

## Ports
- Binds to `HOST:PORT`, default `0.0.0.0:3000`.

## Health Endpoint
- `GET /health`

## API Surface (Operational)
- `POST /payments/internal-transfer`
- `GET /payments`
- `GET /payments/:paymentId`
- `POST /beneficiaries`

## Events Published
- `payment.initiated.v1`
- `payment.status.updated.v1`

## Events Consumed
- `payment.initiated.v1` (processor consumer)

## Startup Notes
- HTTP API can start before processor consumer, but async completion depends on consumer.
- Keep DLQ/retry framework aligned with shared-events conventions.

## Common Failure Modes
- Kafka publish failure after payment persistence.
- Duplicate idempotency key conflicts.
- Invalid state transitions in processor path.
