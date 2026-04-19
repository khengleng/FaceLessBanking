import Fastify, { type FastifyInstance } from 'fastify';

import { buildRulesEngineApplication } from './application/build-rules-engine.application.js';
import { getHealth } from './controllers/health.controller.js';
import { buildRulesEngineController } from './controllers/rules-engine.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  const rulesEngineApplication = buildRulesEngineApplication();
  const rulesController = buildRulesEngineController(rulesEngineApplication);

  app.get('/health', getHealth);
  app.post('/rules/evaluate', rulesController.evaluateRule);
  app.post('/rules/definitions', rulesController.createRuleDefinition);
  app.get('/rules/definitions/:ruleId', rulesController.getRuleDefinition);

  return app;
}
