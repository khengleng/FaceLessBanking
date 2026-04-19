# FaceLessBanking - Codex Instructions

## Core rules
- This is a banking platform. Never bypass auth, audit, idempotency, or event logging.
- Never log PII, tokens, secrets, raw KYC documents.
- All write APIs must require idempotency.
- Controllers must stay thin.
- Business logic belongs in application/domain layers.
- External integrations must go through adapters.
- All money movement must emit audit + events.

## Stack
- Node.js + TypeScript
- pnpm workspace
- PostgreSQL
- Redis
- Kafka
- OpenTelemetry

## Commands
- install: pnpm install
- lint: pnpm lint
- typecheck: pnpm typecheck
- test: pnpm test

## Service structure
- src/controllers → API only
- src/application → orchestration
- src/domain → business logic
- src/adapters → external calls
- src/events → Kafka
- src/tests → tests

## Delivery rules
- Make smallest safe change
- Do not modify unrelated files
- Always add tests for behavior
- Use adapters for external systems