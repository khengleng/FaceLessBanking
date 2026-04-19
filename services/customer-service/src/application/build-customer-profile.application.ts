import type { PostgresClient } from '../adapters/postgres-customer.adapter.js';
import { PostgresCustomerAdapter } from '../adapters/postgres-customer.adapter.js';
import { CustomerProfileEnrichmentMetrics } from '../events/metrics.js';

import { CustomerProfileApplication } from './customer-profile.application.js';

export function buildCustomerProfileApplication(deps: {
  db: PostgresClient;
  metrics?: CustomerProfileEnrichmentMetrics;
}): CustomerProfileApplication {
  const postgresAdapter = new PostgresCustomerAdapter(deps.db);
  const metrics = deps.metrics ?? new CustomerProfileEnrichmentMetrics();
  return new CustomerProfileApplication(postgresAdapter, metrics);
}
