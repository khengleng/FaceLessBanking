import { randomUUID } from 'node:crypto';

import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';

import type { PostgresClient } from './adapters/postgres-search-index.adapter.js';
import { buildSearchIndexingApplication } from './application/build-search-indexing.application.js';
import { buildSearchController } from './controllers/search.controller.js';
import { getHealth } from './controllers/health.controller.js';

type AppDepsOverride = {
  db?: PostgresClient;
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

  const searchApplication = buildSearchIndexingApplication({ db });
  const searchController = buildSearchController(searchApplication);

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
  app.get('/search', searchController.search);
  app.get('/search/:entityType/:entityId', searchController.getByEntity);

  return app;
}
