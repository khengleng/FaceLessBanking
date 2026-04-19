import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

export type RateLimitMiddlewareOptions = {
  enabled?: boolean;
  maxRequests?: number;
  windowMs?: number;
};

export function registerRateLimitMiddleware(
  app: FastifyInstance,
  options?: RateLimitMiddlewareOptions
): void {
  if (options?.enabled === false) {
    return;
  }

  const maxRequests = options?.maxRequests ?? 100;
  const windowMs = options?.windowMs ?? 60_000;
  const store = new Map<string, RateLimitRecord>();

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.routeOptions.url === '/health') {
      return;
    }

    pruneExpiredRecords(store);

    const key = buildRateLimitKey(request);
    const now = Date.now();
    const record = store.get(key);

    if (!record) {
      store.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      setRateLimitHeaders(reply, maxRequests, maxRequests - 1, windowMs);
      return;
    }

    if (record.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
      reply
        .header('retry-after', retryAfterSeconds)
        .code(429)
        .send({
          error: 'rate_limit_exceeded',
          details: ['Too many requests']
        });
      return;
    }

    record.count += 1;
    store.set(key, record);
    setRateLimitHeaders(reply, maxRequests, Math.max(0, maxRequests - record.count), record.resetAt - now);
  });
}

function buildRateLimitKey(request: FastifyRequest): string {
  const userId = getHeaderValue(request, 'x-user-id') ?? 'anonymous';
  return [
    userId,
    request.method.toUpperCase(),
    request.routeOptions.url
  ].join(':');
}

function setRateLimitHeaders(
  reply: FastifyReply,
  limit: number,
  remaining: number,
  windowMs: number
): void {
  reply.header('x-rate-limit-limit', limit);
  reply.header('x-rate-limit-remaining', remaining);
  reply.header('x-rate-limit-window-ms', Math.max(0, Math.floor(windowMs)));
}

function pruneExpiredRecords(store: Map<string, RateLimitRecord>): void {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (value.resetAt <= now) {
      store.delete(key);
    }
  }
}

function getHeaderValue(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }

  return typeof value === 'string' ? value : undefined;
}

