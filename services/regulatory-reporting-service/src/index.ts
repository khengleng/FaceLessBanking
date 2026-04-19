import { createApp } from './app.js';
import { bootstrapOpenTelemetry } from './observability/otel.js';

bootstrapOpenTelemetry('regulatory-reporting-service');

const app = createApp();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

app
  .listen({ port, host })
  .then(() => {
    app.log.info({ port, host }, 'regulatory-reporting-service listening');
  })
  .catch((error: unknown) => {
    app.log.error({ error }, 'failed to start regulatory-reporting-service');
    process.exit(1);
  });
