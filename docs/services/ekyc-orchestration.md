# ekyc-orchestration Runbook

## Purpose
- Handles eKYC session orchestration and Sumsub webhook-driven status transitions.

## Dependencies
- Postgres eKYC session/status adapter baseline
- Kafka event publisher
- Sumsub webhook signature verifier adapter

## Required Environment Variables
- `PORT` (optional, default `3000`)
- `HOST` (optional, default `0.0.0.0`)
- `SUMSUB_WEBHOOK_SECRET` (required for webhook signature verification)

## Ports
- Binds to `HOST:PORT`, default `0.0.0.0:3000`.

## Health Endpoint
- `GET /health`

## API Surface (Operational)
- `POST /ekyc/sessions`
- `POST /ekyc/sessions/:sessionId/documents`
- `POST /ekyc/sessions/:sessionId/liveness`
- `GET /ekyc/sessions/:sessionId`
- `POST /webhooks/sumsub`

## Events Published
- `ekyc.session.created.v1`
- `ekyc.status.updated.v1`

## Events Consumed
- None in current baseline.

## Startup Notes
- Webhook endpoint requires raw-body signature verification path intact.
- Do not log webhook secrets or raw sensitive payload artifacts.

## Common Failure Modes
- Invalid/missing Sumsub signature.
- Duplicate webhook delivery reprocessing.
- Applicant/session mapping missing for received webhook.
