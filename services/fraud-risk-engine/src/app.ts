import Fastify, { type FastifyInstance } from 'fastify';

import { buildFraudRiskEngineApplication } from './application/build-fraud-risk-engine.application.js';
import { buildFraudRiskEngineController } from './controllers/fraud-risk-engine.controller.js';
import { getHealth } from './controllers/health.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  const application = buildFraudRiskEngineApplication();
  const controller = buildFraudRiskEngineController(application);

  app.get('/health', getHealth);
  app.post('/risk/score', controller.scoreRisk);
  app.post('/risk/alerts', controller.createAlert);
  app.get('/risk/alerts/:alertId', controller.getAlert);

  return app;
}
