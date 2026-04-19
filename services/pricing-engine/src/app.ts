import Fastify, { type FastifyInstance } from 'fastify';
import { PricingApplication } from './application/pricing.application.js';
import { MockFXRateServiceAdapter, MockRulesEngineAdapter } from './adapters/pricing-adapters.js';
import { buildPricingController } from './controllers/pricing.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  const rulesAdapter = new MockRulesEngineAdapter();
  const fxRateAdapter = new MockFXRateServiceAdapter();
  
  const application = new PricingApplication(rulesAdapter, fxRateAdapter, app.log);
  const controller = buildPricingController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  
  app.post('/pricing/transfers/calculate', controller.calculateTransferPricing);
  app.post('/pricing/fx/calculate', controller.calculateFXPricing);

  return app;
}
