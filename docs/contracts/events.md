# Event Contracts

This document defines the canonical event contract for FaceLessBanking services.

## Canonical Envelope

All published domain events use a shared envelope with these fields:

- `specVersion`: envelope specification version (`1.0`)
- `type`: event type name (for example `customer.created.v1`)
- `version`: semantic event version number for the event payload (`1`)
- `metadata`:
  - `eventId`: globally unique event identifier
  - `correlationId`: request/workflow correlation identifier
  - `causationId`: upstream command/event identifier (optional)
  - `timestamp`: event creation timestamp (ISO 8601)
  - `producer`: producing service identifier
- `payload`: event-specific body

## Versioning Approach

The versioning strategy is explicit and additive:

1. Event type names include a major version suffix, for example `*.v1`.
2. `version` in the envelope mirrors that payload major version.
3. Breaking payload changes require a new event type version (`*.v2`) and dual-publish migration where needed.
4. Non-breaking additions should be optional fields in the same major version.
5. `specVersion` version-controls the shared envelope independently from payload event versions.

## Placeholder Event Types (Current)

- `customer.created.v1`
- `account.created.v1`
- `loan.created.v1`
- `payment.initiated.v1`
- `payment.status.updated.v1`
- `notification.requested.v1`
- `ekyc.status.updated.v1`

## Schemas

Canonical TypeScript and JSON-schema-like definitions live in:

- `packages/shared-events/src/types.ts`
- `packages/shared-events/src/schemas.ts`

These definitions are the source of truth for producer and consumer contracts.

## Minimal Backbone

The minimal event backbone is implemented in:

- `packages/shared-events/src/backbone.ts`

It provides:

- `EventBackboneProducer`: canonical envelope construction and publish path
- `EventBackboneConsumer`: consumer setup placeholder
- retry placeholder config (`maxAttempts`)
- DLQ placeholder config (`enabled`, `topic`)

Current implementation behavior:

1. Producer wraps payloads into the canonical envelope.
2. Producer retries publish attempts based on config.
3. If retries are exhausted and DLQ is enabled, event is stored in DLQ placeholder storage.
4. Consumer exposes subscribe/start placeholders without full broker polling implementation.
