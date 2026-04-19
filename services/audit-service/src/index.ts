import { createApp } from './app.js';
import { buildPaymentAuditEnricher } from './application/build-payment-audit-enricher.application.js';
import { bootstrapOpenTelemetry } from './observability/otel.js';

const SERVICE_NAME = 'audit-service';
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';

async function start(): Promise<void> {
  bootstrapOpenTelemetry(SERVICE_NAME);

  const enricher = buildPaymentAuditEnricher({
    logger: {
      info: (payload: Record<string, unknown>, message: string): void => {
        console.info(JSON.stringify({ level: 'info', service: SERVICE_NAME, message, ...payload }));
      },
      warn: (payload: Record<string, unknown>, message: string): void => {
        console.warn(JSON.stringify({ level: 'warn', service: SERVICE_NAME, message, ...payload }));
      },
      error: (payload: Record<string, unknown>, message: string): void => {
        console.error(JSON.stringify({ level: 'error', service: SERVICE_NAME, message, ...payload }));
      }
    }
  });
  await enricher.consumer.subscribe();
  await enricher.consumer.start();

  const app = createApp();
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const host = process.env.HOST ?? DEFAULT_HOST;

  await app.listen({ port, host });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((error: unknown) => {
    // Logging intentionally minimal and does not include sensitive request data.
    console.error('Failed to start audit-service', error);
    process.exit(1);
  });
}
