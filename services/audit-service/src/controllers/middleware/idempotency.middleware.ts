import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type IdempotencyRecordStatus = 'processing' | 'completed';

type IdempotencyRecord = {
  status: IdempotencyRecordStatus;
  createdAt: number;
};

type IdempotencyStore = Map<string, IdempotencyRecord>;

const IDEMPOTENT_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export type IdempotencyMiddlewareOptions = {
  enabled?: boolean;
  ttlMs?: number;
};

declare module 'fastify' {
  interface FastifyRequest {
    idempotencyStoreKey?: string;
  }
}

export function registerIdempotencyMiddleware(
  app: FastifyInstance,
  options?: IdempotencyMiddlewareOptions
): void {
  if (options?.enabled === false) {
    return;
  }

  const ttlMs = options?.ttlMs ?? 24 * 60 * 60 * 1000;
  const store: IdempotencyStore = new Map();

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!IDEMPOTENT_METHODS.has(request.method.toUpperCase())) {
      return;
    }

    pruneExpiredRecords(store, ttlMs);

    const idempotencyKey = getHeaderValue(request, 'idempotency-key');
    if (!idempotencyKey || idempotencyKey.trim().length < 4) {
      reply.code(400).send({
        error: 'validation_failed',
        details: ['idempotency-key header is required for write requests']
      });
      return;
    }

    const storeKey = buildStoreKey(request, idempotencyKey);
    request.idempotencyStoreKey = storeKey;

    const existing = store.get(storeKey);
    if (!existing) {
      store.set(storeKey, {
        status: 'processing',
        createdAt: Date.now()
      });
      return;
    }

    if (existing.status === 'processing') {
      reply.code(409).send({
        error: 'idempotency_in_progress'
      });
      return;
    }

    reply.code(409).send({
      error: 'duplicate_request'
    });
  });

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const storeKey = request.idempotencyStoreKey;
    if (!storeKey) {
      return;
    }

    if (reply.statusCode >= 400) {
      store.delete(storeKey);
      return;
    }

    const existing = store.get(storeKey);
    if (!existing) {
      return;
    }

    store.set(storeKey, {
      status: 'completed',
      createdAt: existing.createdAt
    });
  });
}

function pruneExpiredRecords(store: IdempotencyStore, ttlMs: number): void {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (now - value.createdAt > ttlMs) {
      store.delete(key);
    }
  }
}

function buildStoreKey(request: FastifyRequest, idempotencyKey: string): string {
  const userId = getHeaderValue(request, 'x-user-id') ?? 'anonymous';
  return [
    userId,
    request.method.toUpperCase(),
    request.routeOptions.url,
    idempotencyKey
  ].join(':');
}

function getHeaderValue(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }

  return typeof value === 'string' ? value : undefined;
}

