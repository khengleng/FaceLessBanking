import { createApp } from './app.js';
import { bootstrapOpenTelemetry } from './observability/otel.js';

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  bootstrapOpenTelemetry('derivatives');

  const app = createApp();

  try {
    await app.listen({ host: '0.0.0.0', port: PORT });
    app.log.info({ port: PORT }, 'Derivatives service listening');
  } catch (error: unknown) {
    app.log.error({ error }, 'Failed to start derivatives service');
    process.exit(1);
  }
}

void start();
