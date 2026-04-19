# api-gateway Runbook

## Purpose
- Public/internal entrypoint for routing HTTP requests to first-wave backend services.

## Dependencies
- Downstream HTTP services:
  - customer-service
  - account-service
  - loan-orchestration
  - payment-orchestration
  - ekyc-orchestration
  - support-crm-service
- Shared API envelope and correlation propagation conventions.

## Required Environment Variables
- `PORT` (optional, default `3000`)
- `HOST` (optional, default `0.0.0.0`)
- `CUSTOMER_SERVICE_URL` (optional in local, recommended explicit)
- `ACCOUNT_SERVICE_URL` (optional in local, recommended explicit)
- `LOAN_ORCHESTRATION_URL` (optional in local, recommended explicit)
- `PAYMENT_ORCHESTRATION_URL` (optional in local, recommended explicit)
- `EKYC_ORCHESTRATION_URL` (optional in local, recommended explicit)
- `SUPPORT_CRM_SERVICE_URL` (optional in local, recommended explicit)

## Ports
- Binds to `HOST:PORT`, default `0.0.0.0:3000`.

## Health Endpoint
- `GET /health`

## API Surface (Operational)
- Proxies/aggregates downstream route families for customer/account/loan/payment/eKYC/support.
- `GET /health` for readiness checks.

## Events Published
- None (HTTP gateway only).

## Events Consumed
- None.

## Startup Notes
- Start after core downstream services are reachable.
- Validate all configured `*_URL` endpoints resolve before exposing ingress.

## Common Failure Modes
- Downstream timeout/unreachable.
- Misconfigured base URL env vars.
- Correlation ID propagation missing in custom route additions.
