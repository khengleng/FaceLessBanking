import { createApp } from './app.js';
import { bootstrapOpenTelemetry } from './observability/otel.js';

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  bootstrapOpenTelemetry('aml-monitoring');

  const app = createApp();

  try {
    app.log.warn(
      {
        canonicalService: 'aml-monitoring-service'
      },
      'Legacy alias service active; prefer canonical service for new deployment/routing'
    );
    await app.listen({ host: '0.0.0.0', port: PORT });
    app.log.info({ port: PORT }, 'AML monitoring service listening');
  } catch (error: unknown) {
    app.log.error({ error }, 'Failed to start AML monitoring service');
    process.exit(1);
  }
}

void start();
