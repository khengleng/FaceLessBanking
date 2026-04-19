import Fastify, { type FastifyInstance } from 'fastify';
import { NIIApplication } from './application/nii.application.js';
import { IrrEngineAdapterStub, AccountingAdapterStub } from './adapters/nii-adapters.js';
import { buildNIIController } from './controllers/nii.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  const irrAdapter = new IrrEngineAdapterStub();
  const accountingAdapter = new AccountingAdapterStub();
  const application = new NIIApplication(irrAdapter, accountingAdapter, app.log);
  const controller = buildNIIController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  
  app.get('/nii/baseline', controller.getBaseline);
  app.get('/nii/baseline/:currency', controller.getBaseline);
  
  app.post('/nii/simulate-shock', controller.simulateShock);
  app.post('/nii/simulate-shock/:currency', controller.simulateShock);
  
  app.get('/nii/standard-scenarios', controller.getStandardScenarios);
  app.get('/nii/standard-scenarios/:currency', controller.getStandardScenarios);

  return app;
}
