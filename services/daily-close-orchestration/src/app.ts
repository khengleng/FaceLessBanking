import Fastify from 'fastify';
import type { Producer } from 'kafkajs';
import { PostgresBatchAdapter } from './adapters/postgres-batch.adapter.js';
import { InternalJobsAdapter } from './adapters/internal-jobs.adapter.js';
import { BatchEventsPublisher } from './events/batch-publisher.adapter.js';
import { DailyCloseApplication } from './application/daily-close.application.js';
import { buildDailyCloseController } from './controllers/daily-close.controller.js';

export function buildApp(params: {
  kafkaProducer: Producer;
}) {
  const app = Fastify({ logger: true });

  const postgresAdapter = new PostgresBatchAdapter();
  const jobsAdapter = new InternalJobsAdapter(app.log);
  const eventsPublisher = new BatchEventsPublisher(params.kafkaProducer);
  
  const dailyCloseApp = new DailyCloseApplication(
    postgresAdapter,
    jobsAdapter,
    eventsPublisher,
    app.log
  );

  const controller = buildDailyCloseController(dailyCloseApp);

  app.get('/health', controller.health);
  app.post('/daily-close/run', controller.startRun);
  app.get('/daily-close/runs/:runId', controller.getRun);

  return { app, dailyCloseApp };
}
