# reconciliation-service Runbook

## Purpose
- Manages reconciliation jobs, run lifecycle, and mismatch capture.

## Dependencies
- Postgres reconciliation adapter
- Event publisher adapter for reconciliation lifecycle notifications

## Required Environment Variables
- `PORT` (optional, default `3000`)
- `HOST` (optional, default `0.0.0.0`)

## Ports
- Binds to `HOST:PORT`, default `0.0.0.0:3000`.

## Health Endpoint
- `GET /health`

## API Surface (Operational)
- `POST /reconciliation/jobs`
- `GET /reconciliation/jobs/:jobId`
- `POST /reconciliation/jobs/:jobId/run`

## Events Published
- `reconciliation.job.started.v1`
- `reconciliation.job.completed.v1`
- `reconciliation.mismatch.detected.v1`

## Events Consumed
- None in current baseline.

## Startup Notes
- Job runs should be serialized per `jobId` by processed-run guards.
- Use controlled scheduling to avoid overlapping heavy comparisons.

## Common Failure Modes
- Duplicate run invocation race.
- Large mismatch sets causing slow completion.
- Upstream source/target adapters returning inconsistent snapshots.
