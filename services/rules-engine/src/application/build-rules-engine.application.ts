import { PostgresRulesAdapter } from '../adapters/postgres-rules.adapter.js';

import { RulesEngineApplication } from './rules-engine.application.js';

export function buildRulesEngineApplication(): RulesEngineApplication {
  const postgresAdapter = new PostgresRulesAdapter();
  return new RulesEngineApplication(postgresAdapter);
}
