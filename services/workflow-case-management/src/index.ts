import { createApp } from './app.js';
import { PostgresCaseAdapter } from './adapters/postgres-case.adapter.js';
import { KafkaProducerAdapter } from './adapters/kafka-producer.adapter.js';
import { buildOnboardingWorkflowApplication } from './application/build-onboarding-workflow.application.js';
import { buildWorkflowCaseManagementApplication } from './application/build-workflow-case-management.application.js';
import { CaseEventsPublisher } from './events/case.events.js';
import { bootstrapOpenTelemetry } from './observability/otel.js';

const SERVICE_NAME = 'workflow-case-management';
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';

async function start(): Promise<void> {
  bootstrapOpenTelemetry(SERVICE_NAME);

  const postgresAdapter = new PostgresCaseAdapter();
  const kafkaProducer = new KafkaProducerAdapter();
  const eventsPublisher = new CaseEventsPublisher(kafkaProducer);

  const workflowApplication = buildWorkflowCaseManagementApplication({
    postgresAdapter,
    kafkaProducer,
    eventsPublisher
  });

  const onboardingWorkflow = buildOnboardingWorkflowApplication({
    postgresAdapter,
    eventsPublisher,
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
  await onboardingWorkflow.consumer.subscribe();
  await onboardingWorkflow.consumer.start();

  const app = createApp({
    application: workflowApplication
  });
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const host = process.env.HOST ?? DEFAULT_HOST;

  await app.listen({ port, host });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((error: unknown) => {
    console.error('Failed to start workflow-case-management', error);
    process.exit(1);
  });
}
