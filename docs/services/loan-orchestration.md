# loan-orchestration Runbook

## Purpose
- Owns loan application lifecycle, disbursement orchestration, schedule generation, repayment initiation, and delinquency/accrual skeleton flows.

## Dependencies
- Postgres adapter baseline (currently in-memory implementation pattern)
- Kafka producer/consumer for loan lifecycle events
- Internal payment adapter placeholder
- Workflow integration placeholder

## Required Environment Variables
- `PORT` (optional, default `3000`)
- `HOST` (optional, default `0.0.0.0`)
- `LOAN_FUNDING_ACCOUNT_ID` (optional, default `loan-funding-account`)

## Ports
- Binds to `HOST:PORT`, default `0.0.0.0:3000`.

## Health Endpoint
- `GET /health`

## API Surface (Operational)
- `POST /loans`
- `GET /loans/:loanId`
- `POST /loans/:loanAccountId/repayments`

## Events Published
- `loan.created.v1`
- `loan.repayment.initiated.v1`
- `loan.disbursement.initiated.v1`
- `loan.delinquent.v1`
- `loan.schedule.generated.v1`
- `loan.interest.accrued.v1`

## Events Consumed
- `loan.account.created.v1` (disbursement + schedule consumers)

## Startup Notes
- Ensure payment-orchestration endpoint/adapter is reachable before enabling disbursement/repayment jobs.
- Run delinquency/accrual triggers in controlled windows.

## Common Failure Modes
- Duplicate disbursement or schedule trigger events.
- Invalid loan state transition.
- Missing downstream payment path blocks initiation completion.
