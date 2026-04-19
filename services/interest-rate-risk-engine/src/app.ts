import Fastify, { type FastifyInstance } from 'fastify';
import { IRRApplication } from './application/irr.application.js';
import { PostgresIRRAdapter } from './adapters/postgres-irr.adapter.js';
import { buildIRRController } from './controllers/irr.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  const postgresAdapter = new PostgresIRRAdapter();
  const application = new IRRApplication(postgresAdapter, app.log);
  const controller = buildIRRController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  
  app.get('/irr/repricing-gaps', controller.getRepricingGaps);
  app.get('/irr/repricing-gaps/:currency', controller.getRepricingGaps);

  app.get('/irr/nii-sensitivity', controller.getNIISensitivity);
  app.get('/irr/nii-sensitivity/:currency', controller.getNIISensitivity);
  app.post('/irr/nii-sensitivity/scenario', controller.postNIISensitivityScenario);
  app.post('/irr/nii-sensitivity/scenario/:currency', controller.postNIISensitivityScenario);

  app.get('/irr/scenarios', controller.getScenarios);
  app.post('/irr/scenarios/run', controller.postRunScenario);
  app.get('/irr/scenarios/results/:scenarioId', controller.getScenarioResult);

  return app;
}
