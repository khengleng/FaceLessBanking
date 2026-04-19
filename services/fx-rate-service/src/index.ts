import { createApp } from './app.js';
import { bootstrapOpenTelemetry } from './observability/otel.js';

const SERVICE_NAME = 'fx-rate-service';
const PORT = Number(process.env.PORT) || 3000;

async function start() {
  bootstrapOpenTelemetry(SERVICE_NAME);

  const app = createApp();
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`FX Rate Service listening on port ${PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
