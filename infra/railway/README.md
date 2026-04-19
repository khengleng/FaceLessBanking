# Railway Staging Profile (Placeholder)

This folder provides staging-oriented deployment guidance for Railway.

## Scope

- Intended for test/staging environments.
- Uses managed add-ons for Postgres/Redis/Kafka where available.
- Keeps service deployment independent per service.

## Initial rollout recommendation

1. api-gateway
2. customer-service
3. account-service
4. payment-orchestration
5. balance-service

## Notes

- Use service-level env vars from `env/staging.env.example`.
- Inject secrets in Railway variables UI, not in repo files.
- Keep per-service start command aligned to `pnpm --filter <pkg> start`.
