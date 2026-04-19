import { randomUUID } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';
import { buildErrorResponse, toCorrelationId } from '@faceless-banking/shared-types';

const CORRELATION_ID_HEADER = 'x-correlation-id';

export async function correlationIdMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const headerValue = request.headers[CORRELATION_ID_HEADER];
  const correlationId = typeof headerValue === 'string' && headerValue.length > 0 ? headerValue : randomUUID();

  request.correlationId = correlationId;
  reply.header(CORRELATION_ID_HEADER, correlationId);
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (request.raw.url?.startsWith('/health')) {
    return;
  }

  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({
      error: 'unauthorized',
      details: ['Missing bearer token. TODO: validate Keycloak token.']
    });
    return;
  }

  // TODO: Replace placeholder check with full Keycloak JWT validation.
}

export type RateLimitPolicy = {
  policyId: string;
  routePrefix: string;
  methods?: string[];
  limit: number;
  windowSeconds: number;
  principalMode?: 'user' | 'ip' | 'auto';
};

export type RateLimitCounterResult = {
  count: number;
  resetAt: string;
};

export interface RateLimitCounterAdapter {
  incrementAndGet(input: {
    key: string;
    windowSeconds: number;
    now: Date;
  }): Promise<RateLimitCounterResult>;
}

type RateLimitRecord = {
  count: number;
  resetAtMs: number;
};

export class InMemoryRateLimitCounterAdapter implements RateLimitCounterAdapter {
  private readonly counters = new Map<string, RateLimitRecord>();

  async incrementAndGet(input: {
    key: string;
    windowSeconds: number;
    now: Date;
  }): Promise<RateLimitCounterResult> {
    const resetAtMs = input.now.getTime() + input.windowSeconds * 1000;
    const existing = this.counters.get(input.key);

    if (!existing || input.now.getTime() >= existing.resetAtMs) {
      this.counters.set(input.key, { count: 1, resetAtMs });
      return {
        count: 1,
        resetAt: new Date(resetAtMs).toISOString()
      };
    }

    existing.count += 1;
    this.counters.set(input.key, existing);

    return {
      count: existing.count,
      resetAt: new Date(existing.resetAtMs).toISOString()
    };
  }
}

export const DEFAULT_RATE_LIMIT_POLICIES: RateLimitPolicy[] = [
  {
    policyId: 'payments-write',
    routePrefix: '/payments',
    methods: ['POST'],
    limit: 20,
    windowSeconds: 60,
    principalMode: 'auto'
  },
  {
    policyId: 'loan-write',
    routePrefix: '/loans',
    methods: ['POST'],
    limit: 20,
    windowSeconds: 60,
    principalMode: 'auto'
  },
  {
    policyId: 'default',
    routePrefix: '/',
    limit: 100,
    windowSeconds: 60,
    principalMode: 'auto'
  }
];

export type RateLimitMiddlewareOptions = {
  adapter?: RateLimitCounterAdapter;
  policies?: RateLimitPolicy[];
  now?: () => Date;
};

export function createRateLimitMiddleware(options?: RateLimitMiddlewareOptions) {
  const adapter = options?.adapter ?? new InMemoryRateLimitCounterAdapter();
  const policies = options?.policies ?? DEFAULT_RATE_LIMIT_POLICIES;
  const now = options?.now ?? (() => new Date());

  return async function rateLimitMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (request.raw.url?.startsWith('/health')) {
      return;
    }

    const path = request.raw.url?.split('?')[0] ?? '/';
    const policy = selectPolicy(policies, request.method, path);

    if (!policy) {
      return;
    }

    const principal = resolvePrincipalKey(request, policy.principalMode ?? 'auto');
    const key = `${policy.policyId}:${principal}`;
    const counter = await adapter.incrementAndGet({
      key,
      windowSeconds: policy.windowSeconds,
      now: now()
    });

    const remaining = Math.max(0, policy.limit - counter.count);

    reply.header('x-ratelimit-limit', String(policy.limit));
    reply.header('x-ratelimit-remaining', String(remaining));
    reply.header('x-ratelimit-reset', counter.resetAt);

    if (counter.count <= policy.limit) {
      return;
    }

    reply.code(429).send(
      buildErrorResponse({
        correlationId: toCorrelationId(request.correlationId),
        error: {
          code: 'rate_limited',
          message: 'Too many requests for this route and principal',
          details: [`policy=${policy.policyId}`, `resetAt=${counter.resetAt}`],
          retriable: true
        }
      })
    );
  };
}

function selectPolicy(
  policies: RateLimitPolicy[],
  method: string,
  path: string
): RateLimitPolicy | null {
  const sorted = [...policies].sort((a, b) => b.routePrefix.length - a.routePrefix.length);

  for (const policy of sorted) {
    const methodMatch =
      !policy.methods ||
      policy.methods.length === 0 ||
      policy.methods.some((candidate) => candidate.toUpperCase() === method.toUpperCase());
    if (!methodMatch) {
      continue;
    }

    if (path.startsWith(policy.routePrefix)) {
      return policy;
    }
  }

  return null;
}

function resolvePrincipalKey(
  request: FastifyRequest,
  mode: 'user' | 'ip' | 'auto'
): string {
  if (mode === 'ip') {
    return `ip:${request.ip}`;
  }

  const principalFromHeader = request.headers['x-user-id'];
  if (typeof principalFromHeader === 'string' && principalFromHeader.trim().length > 0) {
    return `user:${principalFromHeader.trim()}`;
  }

  if (mode === 'user') {
    return 'user:anonymous';
  }

  const authHeader = request.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return `principal:${authHeader.slice('Bearer '.length)}`;
  }

  return `ip:${request.ip}`;
}
