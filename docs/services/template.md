# <service-name> Runbook

## Purpose
- Service ownership and what this service is responsible for.

## Dependencies
- Data stores (PostgreSQL / Redis)
- Event backbone (Kafka)
- Internal upstream/downstream services
- Shared contracts references:
  - `docs/contracts/events.md`
  - `docs/contracts/api-standards.md`

## Required Environment Variables
- `VAR_NAME` (required): description
- `VAR_NAME` (optional, default=...): description

## Ports
- Default bind host/port
- External exposure notes

## Health Endpoint
- `GET /health`
- Expected success response

## API Surface (Operational)
- List only operationally relevant endpoints.

## Events Published
- `event.name.v1`: trigger condition and purpose

## Events Consumed
- `event.name.v1`: processing purpose and idempotency note

## Startup Notes
- Startup order constraints
- Required infra readiness checks
- Run command notes

## Common Failure Modes
- Dependency unavailable
- Event backlog / publish failures
- Validation/idempotency conflicts
- Suggested first checks
