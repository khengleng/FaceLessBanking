import type { PostgresClient } from '../adapters/postgres-balance-projection.adapter.js';
import type { RedisClient } from '../adapters/redis-balance.adapter.js';
import { PostgresBalanceProjectionAdapter } from '../adapters/postgres-balance-projection.adapter.js';
import { RedisBalanceAdapter } from '../adapters/redis-balance.adapter.js';
import { BalanceEventsPublisher } from '../events/balance.events.js';
import { BalanceMetrics } from '../events/metrics.js';

import { BalanceApplication } from './balance.application.js';

export function buildBalanceApplication(deps: {
  db: PostgresClient;
  redis: RedisClient;
  cacheTtlSeconds: number;
}): BalanceApplication {
  const redisAdapter = new RedisBalanceAdapter(deps.redis, {
    keyPrefix: process.env.BALANCE_CACHE_KEY_PREFIX ?? 'balance:',
    ttlSeconds: deps.cacheTtlSeconds
  });
  const postgresAdapter = new PostgresBalanceProjectionAdapter(deps.db);
  const metrics = new BalanceMetrics();
  const eventsPublisher = new BalanceEventsPublisher();

  return new BalanceApplication(
    redisAdapter,
    postgresAdapter,
    metrics,
    eventsPublisher,
    deps.cacheTtlSeconds
  );
}
