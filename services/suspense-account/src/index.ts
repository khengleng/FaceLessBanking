import { createApp } from './app.js';
import { bootstrapOpenTelemetry } from './observability/otel.js';

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  bootstrapOpenTelemetry('suspense-account');

  const app = createApp();

  try {
    await app.listen({ host: '0.0.0.0', port: PORT });
    app.log.info({ port: PORT }, 'Suspense account service listening');
  } catch (error: unknown) {
    app.log.error({ error }, 'Failed to start suspense account service');
    process.exit(1);
  }
}

void start();
