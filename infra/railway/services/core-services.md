# Railway core services mapping (placeholder)

Suggested first-wave service deployment targets:

- api-gateway
- customer-service
- account-service
- payment-orchestration
- balance-service

Each service should:
- use its own SERVICE_NAME
- expose PORT from Railway runtime
- consume service-specific env vars from service `.env.example`
