# ledger-service Runbook

## Purpose
- Provides ledger anchoring/proof placeholder APIs and event hook for audit anchoring workflows.

## Dependencies
- Postgres ledger adapter baseline (in-memory pattern currently)
- Kafka publish/subscribe adapters for anchor flow placeholders

## Required Environment Variables
- `PORT` (optional, default `3000`)
- `HOST` (optional, default `0.0.0.0`)

## Ports
- Binds to `HOST:PORT`, default `0.0.0.0:3000`.

## Health Endpoint
- `GET /health`

## API Surface (Operational)
- `POST /ledger/anchors`
- `GET /ledger/anchors/:anchorId`
- `GET /ledger/proofs/:eventId`

## Events Published
- `ledger.anchor.requested` (non-canonical placeholder naming currently)

## Events Consumed
- `audit.events` subscription placeholder

## Startup Notes
- Keep this service treated as early skeleton until canonical event naming alignment is completed.
- Validate proof lookup semantics before externalizing to compliance tooling.

## Common Failure Modes
- Missing anchor event payload data.
- Non-canonical event naming drift vs shared-events contract.
- Proof lookup miss due to unanchored source event.
