import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { buildErrorResponse, toCorrelationId } from '@faceless-banking/shared-types';

const CORRELATION_ID_HEADER = 'x-correlation-id';

// Extended request type to hold user information
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email?: string;
      roles: string[];
      permissions: string[];
    };
    correlationId: string;
  }
}

export async function correlationIdMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const headerValue = request.headers[CORRELATION_ID_HEADER];
  const correlationId = typeof headerValue === 'string' && headerValue.length > 0 ? headerValue : randomUUID();

  (request as any).correlationId = correlationId;
  reply.header(CORRELATION_ID_HEADER, correlationId);
}

const client = jwksClient({
  jwksUri: process.env.JWKS_URI || 'http://localhost:8080/realms/faceless-banking/protocol/openid-connect/certs',
  cache: true,
  rateLimit: true,
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
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
    reply.code(401).send(buildErrorResponse({
      correlationId: toCorrelationId(request.correlationId),
      error: {
        code: 'unauthorized',
        message: 'Missing or invalid authorization header',
        details: ['Bearer token is required']
      }
    }));
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = await new Promise<any>((resolve, reject) => {
      jwt.verify(token, getKey, {
        audience: process.env.JWT_AUDIENCE,
        issuer: process.env.JWT_ISSUER
      }, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });

    request.user = {
      id: decoded.sub || decoded.uid,
      email: decoded.email,
      roles: decoded.realm_access?.roles || decoded.roles || [],
      permissions: decoded.resource_access?.[process.env.JWT_AUDIENCE ?? 'api-gateway']?.roles || decoded.scopes || []
    };

    // Also populate x-user-id header for downstream services if not already set
    if (!request.headers['x-user-id']) {
      request.headers['x-user-id'] = request.user.id;
    }

  } catch (error) {
    reply.code(401).send(buildErrorResponse({
      correlationId: toCorrelationId(request.correlationId),
      error: {
        code: 'unauthorized',
        message: 'Invalid token',
        details: [(error as Error).message]
      }
    }));
  }
}

export function permissionGuard(requiredPermission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || !request.user.permissions.includes(requiredPermission)) {
      reply.code(403).send(buildErrorResponse({
        correlationId: toCorrelationId(request.correlationId),
        error: {
          code: 'forbidden',
          message: 'Insufficient permissions',
          details: [`Required: ${requiredPermission}`]
        }
      }));
    }
  };
}

export function roleGuard(requiredRole: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || !request.user.roles.includes(requiredRole)) {
      reply.code(403).send(buildErrorResponse({
        correlationId: toCorrelationId(request.correlationId),
        error: {
          code: 'forbidden',
          message: 'Insufficient roles',
          details: [`Required: ${requiredRole}`]
        }
      }));
    }
  };
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

import { Redis } from 'ioredis';

export class RedisRateLimitCounterAdapter implements RateLimitCounterAdapter {
  private readonly redis: Redis;

  constructor(redisOrUrl?: Redis | string) {
    if (typeof redisOrUrl === 'string') {
      this.redis = new Redis(redisOrUrl);
    } else {
      this.redis = redisOrUrl ?? new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    }
  }

  async incrementAndGet(input: {
    key: string;
    windowSeconds: number;
    now: Date;
  }): Promise<RateLimitCounterResult> {
    const pipeline = this.redis.pipeline();
    pipeline.incr(input.key);
    pipeline.ttl(input.key);
    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Redis pipeline failed');
    }

    const count = results[0][1] as number;
    let ttl = results[1][1] as number;

    if (ttl === -1) {
      await this.redis.expire(input.key, input.windowSeconds);
      ttl = input.windowSeconds;
    }

    const resetAt = new Date(input.now.getTime() + ttl * 1000).toISOString();

    return {
      count,
      resetAt
    };
  }
}

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
  const adapter = options?.adapter ?? (process.env.REDIS_URL 
    ? new RedisRateLimitCounterAdapter(process.env.REDIS_URL) 
    : new InMemoryRateLimitCounterAdapter());
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

  const userId = request.user?.id;
  if (userId) {
    return `user:${userId}`;
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
