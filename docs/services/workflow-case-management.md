# workflow-case-management Runbook

## Purpose
- Owns case lifecycle management for onboarding review, case actions, maker-checker, and dispute workflows.

## Dependencies
- Postgres adapter baseline (in-memory pattern currently)
- Kafka producer/consumer for onboarding and case events

## Required Environment Variables
- `PORT` (optional, default `3000`)
- `HOST` (optional, default `0.0.0.0`)

## Ports
- Binds to `HOST:PORT`, default `0.0.0.0:3000`.

## Health Endpoint
- `GET /health`

## API Surface (Operational)
- `POST /cases`
- `GET /cases/onboarding-review`
- `GET /cases`
- `GET /cases/:caseId`
- `POST /cases/:caseId/actions`
- `POST /maker-checker/evaluate`
- `POST /maker-checker/policies`
- `GET /maker-checker/policies/:policyId`
- `POST /disputes`
- `GET /disputes/:disputeId`
- `POST /disputes/:disputeId/escalate`
- `POST /disputes/:disputeId/resolve`

## Events Published
- `case.created.v1`
- `case.action.recorded.v1`
- `makerchecker.policy.applied.v1`
- `dispute.created.v1`
- `dispute.updated.v1`

## Events Consumed
- `ekyc.status.updated.v1`

## Startup Notes
- Start consumer path for onboarding transitions before replaying eKYC events.
- Keep case status transition validation strict.

## Common Failure Modes
- Invalid transition attempts blocked.
- Duplicate workflow event reprocessing.
- Entity-case linkage missing for onboarding state updates.
