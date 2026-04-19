# Environment Contract

Common variables expected across services:

- `NODE_ENV`
- `PORT`
- `HOST`
- `LOG_LEVEL`

Common infrastructure variables (service-dependent):

- `DATABASE_URL`
- `REDIS_URL`
- `KAFKA_BROKERS`

Domain-specific variables are declared by each service in `services/<service>/.env.example`.
