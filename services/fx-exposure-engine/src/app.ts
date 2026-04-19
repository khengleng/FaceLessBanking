import Fastify, { type FastifyInstance } from 'fastify';

import { InMemoryFxRateAdapter } from './adapters/fx-rate.adapter.js';
import type { FxExposureAdapter } from './adapters/fx-exposure.adapter.js';
import { InMemoryPostgresExposureAdapter } from './adapters/postgres-exposure.adapter.js';
import { FxExposureApplication } from './application/fx-exposure.application.js';
import { buildFxExposureController } from './controllers/fx-exposure.controller.js';
import { FxShockApplication } from './application/fx-shock.application.js';
import { buildFxShockController } from './controllers/fx-shock.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  const postgresAdapter = new InMemoryPostgresExposureAdapter();
  const fxRateAdapter = new InMemoryFxRateAdapter();
  const application = new FxExposureApplication(postgresAdapter, fxRateAdapter, app.log);
  const exposureController = buildFxExposureController(application);

  const fxExposureAdapter: FxExposureAdapter = {
    getCurrentCurrencyExposures: async (reportingCurrency: string) =>
      application.getExposures(reportingCurrency)
  };
  const shockApplication = new FxShockApplication(fxExposureAdapter, app.log);
  const shockController = buildFxShockController(shockApplication);

  app.get('/health', async () => ({ status: 'OK' }));

  app.get('/fx/exposures/summary', exposureController.getExposureSummary);
  app.get('/fx/exposures', exposureController.getExposures);
  app.get('/fx/exposures/:currency', exposureController.getExposureByCurrency);

  app.get('/fx/shocks/scenarios', shockController.getScenarios);
  app.post('/fx/shocks/run', shockController.postRunScenario);
  app.get('/fx/shocks/results/:scenarioId', shockController.getScenarioResult);

  return app;
}
