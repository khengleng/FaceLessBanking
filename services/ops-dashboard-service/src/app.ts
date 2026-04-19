import Fastify, { type FastifyInstance } from 'fastify';
import { buildDashboardController } from './controllers/dashboard.controller.js';
import { DashboardApplication } from './application/dashboard.application.js';
import { MockSearchAdapter } from './adapters/mock-search.adapter.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  const searchAdapter = new MockSearchAdapter();
  const application = new DashboardApplication(searchAdapter);
  const controller = buildDashboardController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  
  app.get('/dashboard/summary', controller.getSummary);
  app.get('/dashboard/payments', controller.getPayments);
  app.get('/dashboard/loans', controller.getLoans);
  app.get('/dashboard/onboarding', controller.getOnboarding);
  app.get('/dashboard/disputes', controller.getDisputes);

  return app;
}
