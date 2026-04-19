import { createApp } from './app.js';
import { bootstrapOpenTelemetry } from './observability/otel.js';

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  bootstrapOpenTelemetry('profitability-engine');

  const app = createApp();
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info({ port: PORT }, 'Profitability Engine listening');
  } catch (error: unknown) {
    app.log.error({ error }, 'Failed to start profitability engine');
    process.exit(1);
  }
}

void start();
