import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';
import {
  InMemoryRateLimitCounterAdapter,
  type RateLimitPolicy
} from '../controllers/middleware.js';

test('GET /health returns health payload and generated correlation id', async () => {
  const app = createApp();

  const response = await app.inject({ method: 'GET', url: '/health' });

  assert.equal(response.statusCode, 200);
  assert.ok(response.headers['x-correlation-id']);

  const payload = response.json() as {
    status: string;
    service: string;
    timestamp: string;
  };

  assert.equal(payload.status, 'ok');
  assert.equal(payload.service, 'api-gateway');
  assert.ok(Date.parse(payload.timestamp) > 0);

  await app.close();
});

test('gateway placeholder rejects missing bearer token', async () => {
  const app = createApp();

  const response = await app.inject({ method: 'GET', url: '/customers' });

  assert.equal(response.statusCode, 401);
  assert.ok(response.headers['x-correlation-id']);

  await app.close();
});

test('gateway adapter forwards correlation id and returns placeholder downstream response', async () => {
  const app = createApp();
  const correlationId = 'cid-test-123';

  const response = await app.inject({
    method: 'POST',
    url: '/payments',
    headers: {
      authorization: 'Bearer stub-token',
      'x-correlation-id': correlationId
    }
  });

  assert.equal(response.statusCode, 501);
  assert.equal(response.headers['x-correlation-id'], correlationId);

  const payload = response.json() as {
    correlationId: string;
    data: {
      route: string;
      message: string;
      todo: string;
      forwardedCorrelationId: string;
      retryMaxAttempts: number;
      requestTimeoutMs: number;
    };
  };

  assert.equal(payload.correlationId, correlationId);
  assert.equal(payload.data.route, 'payments');
  assert.equal(payload.data.message, 'Gateway route placeholder');
  assert.equal(payload.data.forwardedCorrelationId, correlationId);
  assert.equal(payload.data.retryMaxAttempts, 2);
  assert.equal(payload.data.requestTimeoutMs, 1500);

  await app.close();
});

test('rate limit enforced with safe 429 envelope', async () => {
  const policies: RateLimitPolicy[] = [
    {
      policyId: 'payments-tight',
      routePrefix: '/payments',
      methods: ['POST'],
      limit: 1,
      windowSeconds: 60,
      principalMode: 'user'
    }
  ];
  const app = createApp({
    rateLimit: {
      adapter: new InMemoryRateLimitCounterAdapter(),
      policies
    }
  });

  const first = await app.inject({
    method: 'POST',
    url: '/payments',
    headers: {
      authorization: 'Bearer stub-token',
      'x-user-id': 'user-limit-1'
    }
  });
  assert.equal(first.statusCode, 501);

  const second = await app.inject({
    method: 'POST',
    url: '/payments',
    headers: {
      authorization: 'Bearer stub-token',
      'x-user-id': 'user-limit-1'
    }
  });

  assert.equal(second.statusCode, 429);
  const payload = second.json() as {
    success: boolean;
    error: { code: string; message: string };
  };
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'rate_limited');
  assert.ok(second.headers['x-ratelimit-limit']);
  assert.ok(second.headers['x-ratelimit-remaining']);
  assert.ok(second.headers['x-ratelimit-reset']);

  await app.close();
});

test('different users are isolated for counters', async () => {
  const policies: RateLimitPolicy[] = [
    {
      policyId: 'customers-tight',
      routePrefix: '/customers',
      methods: ['GET'],
      limit: 1,
      windowSeconds: 60,
      principalMode: 'user'
    }
  ];
  const app = createApp({
    rateLimit: {
      adapter: new InMemoryRateLimitCounterAdapter(),
      policies
    }
  });

  const firstUserFirst = await app.inject({
    method: 'GET',
    url: '/customers',
    headers: {
      authorization: 'Bearer token-a',
      'x-user-id': 'user-a'
    }
  });
  assert.equal(firstUserFirst.statusCode, 501);

  const secondUserFirst = await app.inject({
    method: 'GET',
    url: '/customers',
    headers: {
      authorization: 'Bearer token-b',
      'x-user-id': 'user-b'
    }
  });
  assert.equal(secondUserFirst.statusCode, 501);

  const firstUserSecond = await app.inject({
    method: 'GET',
    url: '/customers',
    headers: {
      authorization: 'Bearer token-a',
      'x-user-id': 'user-a'
    }
  });
  assert.equal(firstUserSecond.statusCode, 429);

  const secondUserSecond = await app.inject({
    method: 'GET',
    url: '/customers',
    headers: {
      authorization: 'Bearer token-b',
      'x-user-id': 'user-b'
    }
  });
  assert.equal(secondUserSecond.statusCode, 429);

  await app.close();
});

test('route-specific limit applied over default policy', async () => {
  const policies: RateLimitPolicy[] = [
    {
      policyId: 'payments-strict',
      routePrefix: '/payments',
      methods: ['POST'],
      limit: 1,
      windowSeconds: 60,
      principalMode: 'user'
    },
    {
      policyId: 'default-wide',
      routePrefix: '/',
      limit: 10,
      windowSeconds: 60,
      principalMode: 'user'
    }
  ];
  const app = createApp({
    rateLimit: {
      adapter: new InMemoryRateLimitCounterAdapter(),
      policies
    }
  });

  const paymentsFirst = await app.inject({
    method: 'POST',
    url: '/payments',
    headers: {
      authorization: 'Bearer token-route',
      'x-user-id': 'user-route'
    }
  });
  assert.equal(paymentsFirst.statusCode, 501);

  const paymentsSecond = await app.inject({
    method: 'POST',
    url: '/payments',
    headers: {
      authorization: 'Bearer token-route',
      'x-user-id': 'user-route'
    }
  });
  assert.equal(paymentsSecond.statusCode, 429);

  const customersFirst = await app.inject({
    method: 'GET',
    url: '/customers',
    headers: {
      authorization: 'Bearer token-route',
      'x-user-id': 'user-route'
    }
  });
  assert.equal(customersFirst.statusCode, 501);

  await app.close();
});

test('counters reset according to configured window placeholder', async () => {
  let nowMs = Date.parse('2026-04-18T00:00:00.000Z');
  const app = createApp({
    rateLimit: {
      adapter: new InMemoryRateLimitCounterAdapter(),
      policies: [
        {
          policyId: 'window-test',
          routePrefix: '/accounts',
          methods: ['GET'],
          limit: 1,
          windowSeconds: 1,
          principalMode: 'user'
        }
      ],
      now: () => new Date(nowMs)
    }
  });

  const first = await app.inject({
    method: 'GET',
    url: '/accounts',
    headers: {
      authorization: 'Bearer token-window',
      'x-user-id': 'user-window'
    }
  });
  assert.equal(first.statusCode, 501);

  const second = await app.inject({
    method: 'GET',
    url: '/accounts',
    headers: {
      authorization: 'Bearer token-window',
      'x-user-id': 'user-window'
    }
  });
  assert.equal(second.statusCode, 429);

  nowMs += 1500;

  const afterReset = await app.inject({
    method: 'GET',
    url: '/accounts',
    headers: {
      authorization: 'Bearer token-window',
      'x-user-id': 'user-window'
    }
  });
  assert.equal(afterReset.statusCode, 501);

  await app.close();
});
