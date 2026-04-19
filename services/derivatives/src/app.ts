import Fastify, { type FastifyInstance } from 'fastify';

import { InMemoryDerivativesEventAdapter, InMemoryDerivativesPostgresAdapter } from './adapters/derivatives.adapters.js';
import { DerivativesApplication } from './application/derivatives.application.js';
import { buildDerivativesController } from './controllers/derivatives.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  const postgres = new InMemoryDerivativesPostgresAdapter();
  const events = new InMemoryDerivativesEventAdapter();
  const application = new DerivativesApplication(postgres, events, app.log);
  const controller = buildDerivativesController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  app.post('/derivatives/fx-forward', controller.postFxForward);
  app.get('/derivatives/:id', controller.getContract);

  return app;
}
