import Fastify, { type FastifyInstance } from 'fastify';

import { InMemoryBalanceDataAdapter, InMemoryLoanDataAdapter } from './adapters/capital.adapters.js';
import { CapitalApplication } from './application/capital.application.js';
import { buildCapitalController } from './controllers/capital.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  const loanAdapter = new InMemoryLoanDataAdapter();
  const balanceAdapter = new InMemoryBalanceDataAdapter();
  const application = new CapitalApplication(loanAdapter, balanceAdapter, app.log);
  const controller = buildCapitalController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  app.get('/capital/rwa', controller.getRwa);
  app.get('/capital/car', controller.getCar);

  return app;
}
