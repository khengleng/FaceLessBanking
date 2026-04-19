# notification-service Runbook

## Purpose
- Creates notification requests and processes async notification lifecycle events.

## Dependencies
- Postgres adapter baseline (in-memory pattern currently)
- Kafka producer/consumer for trigger and delivery events

## Required Environment Variables
- `PORT` (optional, default `3000`)
- `HOST` (optional, default `0.0.0.0`)

## Ports
- Binds to `HOST:PORT`, default `0.0.0.0:3000`.

## Health Endpoint
- `GET /health`

## API Surface (Operational)
- `POST /notifications`
- `GET /notifications/:notificationId`

## Events Published
- `notification.requested.v1`
- `notification.sent.v1`
- `notification.failed.v1`

## Events Consumed
- `payment.status.updated.v1`
- `ekyc.status.updated.v1`
- `case.action.recorded.v1`
- `notification.requested.v1` (delivery worker path)

## Startup Notes
- Trigger consumers and delivery consumer can be started independently.
- Keep template mapping logic isolated and reviewed for customer-safe messaging.

## Common Failure Modes
- Duplicate trigger event creates repeated requests if idempotency check regresses.
- Malformed payloads rejected in consumer validation.
- Delivery worker retries/exhaustion not yet fully operationalized.
