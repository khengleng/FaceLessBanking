import Fastify, { type FastifyInstance } from 'fastify';

import { IslamicBankingApplication } from './application/islamic-banking.application.js';
import { buildIslamicBankingController } from './controllers/islamic-banking.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  const application = new IslamicBankingApplication(app.log);
  const controller = buildIslamicBankingController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  app.post('/islamic/murabaha/calculate', controller.postMurabahaCalculation);

  return app;
}
