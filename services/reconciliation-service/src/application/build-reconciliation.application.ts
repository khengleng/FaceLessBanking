import { PostgresReconciliationAdapter } from '../adapters/postgres-reconciliation.adapter.js';
import { ReconciliationEventsPublisher } from '../events/reconciliation-publisher.adapter.js';

import { ReconciliationApplication } from './reconciliation.application.js';

export function buildReconciliationApplication(): ReconciliationApplication {
  const postgresAdapter = new PostgresReconciliationAdapter();
  const eventPublisher = new ReconciliationEventsPublisher({
    send: async () => {}
  });
  const logger = {
    info: (payload: Record<string, unknown>, message: string) => { void payload; void message; },
    warn: (payload: Record<string, unknown>, message: string) => { void payload; void message; },
    error: (payload: Record<string, unknown>, message: string) => { void payload; void message; }
  };

  return new ReconciliationApplication(
    postgresAdapter,
    eventPublisher,
    logger
  );
}
