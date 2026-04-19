import type { PostgresClient } from '../adapters/postgres-search-index.adapter.js';
import { PostgresSearchIndexAdapter } from '../adapters/postgres-search-index.adapter.js';
import { SearchIndexingMetrics } from '../events/metrics.js';

import { SearchIndexingApplication } from './search-indexing.application.js';

export function buildSearchIndexingApplication(deps: {
  db: PostgresClient;
}): SearchIndexingApplication {
  const postgresAdapter = new PostgresSearchIndexAdapter(deps.db);
  const metrics = new SearchIndexingMetrics();

  return new SearchIndexingApplication(postgresAdapter, metrics);
}
