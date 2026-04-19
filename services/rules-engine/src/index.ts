import { createApp } from './app.js';
import { bootstrapOpenTelemetry } from './observability/otel.js';

const SERVICE_NAME = 'rules-engine';
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';

async function start(): Promise<void> {
  bootstrapOpenTelemetry(SERVICE_NAME);

  const app = createApp();
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const host = process.env.HOST ?? DEFAULT_HOST;

  await app.listen({ port, host });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((error: unknown) => {
    console.error('Failed to start rules-engine', error);
    process.exit(1);
  });
}
