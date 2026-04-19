import Fastify, { type FastifyInstance } from 'fastify';
import { ALMApplication } from './application/alm.application.js';
import { PostgresALMAdapter } from './adapters/postgres-alm.adapter.js';
import { buildALMController } from './controllers/alm.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  const postgresAdapter = new PostgresALMAdapter();
  const application = new ALMApplication(postgresAdapter, app.log);
  const controller = buildALMController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  
  app.get('/alm/positions', controller.getPositions);
  app.get('/alm/positions/:currency', controller.getPositionByCurrency);
  app.get('/alm/summary', controller.getSummary);
  app.get('/alm/maturity-buckets', controller.getMaturityBuckets);
  app.get('/alm/metrics', controller.getMetrics);

  return app;
}
