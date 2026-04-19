import { randomUUID } from 'node:crypto';

import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';
import { Redis } from 'ioredis';

import { buildBalanceApplication } from './application/build-balance.application.js';
import { buildBalanceController } from './controllers/balance.controller.js';
import { getHealth } from './controllers/health.controller.js';
import { buildInternalBalanceController } from './controllers/internal-balance.controller.js';
import type { PostgresClient } from './adapters/postgres-balance-projection.adapter.js';
import type { RedisClient } from './adapters/redis-balance.adapter.js';

type AppDepsOverride = {
  db?: PostgresClient;
  redis?: RedisClient;
};

function resolveCorrelationIdFromHeader(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? randomUUID();
  }

  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  return randomUUID();
}

export function createApp(depsOverride?: AppDepsOverride): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info'
    }
  });

  const db = depsOverride?.db ?? new pg.Pool({
    connectionString: process.env.DATABASE_URL
  });
  const redis = depsOverride?.redis ?? new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

  const cacheTtlSeconds = Number(process.env.BALANCE_CACHE_TTL_SECONDS ?? 60);

  const balanceApplication = buildBalanceApplication({
    db,
    redis,
    cacheTtlSeconds
  });

  const balanceController = buildBalanceController(balanceApplication);
  const internalController = buildInternalBalanceController(balanceApplication);

  app.addHook('onRequest', async (request, reply) => {
    const correlationId = resolveCorrelationIdFromHeader(request.headers['x-correlation-id']);

    request.headers['x-correlation-id'] = correlationId;
    reply.header('x-correlation-id', correlationId);

    request.log.info({
      correlationId,
      method: request.method,
      path: request.url
    }, 'Incoming request');
  });

  app.get('/health', getHealth);
  app.get('/balances/:accountId', balanceController.getBalance);
  app.post('/balances/events/apply', internalController.applyProjectionEvent);

  return app;
}
