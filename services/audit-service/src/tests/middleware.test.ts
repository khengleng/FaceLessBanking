import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';

test('duplicate idempotency key is blocked for same user and API', async () => {
  const app = createApp({
    rateLimit: {
      maxRequests: 100,
      windowMs: 60_000
    }
  });

  const payload = {
    eventType: 'payment.initiated',
    correlationId: 'corr-idem-1',
    entityType: 'payment',
    entityId: 'pay-idem-1',
    payload: { amountCents: 500, currency: 'USD' },
    actor: {
      actorId: 'user-idem',
      actorType: 'customer'
    }
  };

  const first = await app.inject({
    method: 'POST',
    url: '/audit/events',
    headers: {
      'idempotency-key': 'idem-duplicate-key',
      'x-user-id': 'ops-user-1'
    },
    payload
  });

  assert.equal(first.statusCode, 201);

  const duplicate = await app.inject({
    method: 'POST',
    url: '/audit/events',
    headers: {
      'idempotency-key': 'idem-duplicate-key',
      'x-user-id': 'ops-user-1'
    },
    payload
  });

  assert.equal(duplicate.statusCode, 409);
  assert.deepEqual(duplicate.json(), {
    error: 'duplicate_request'
  });

  await app.close();
});

test('rate limit is enforced per user and API', async () => {
  const app = createApp({
    rateLimit: {
      maxRequests: 2,
      windowMs: 60_000
    }
  });

  const first = await app.inject({
    method: 'GET',
    url: '/audit/events?entityType=payment&entityId=pay-rate-1',
    headers: {
      'x-user-id': 'rate-user-1'
    }
  });

  const second = await app.inject({
    method: 'GET',
    url: '/audit/events?entityType=payment&entityId=pay-rate-1',
    headers: {
      'x-user-id': 'rate-user-1'
    }
  });

  const third = await app.inject({
    method: 'GET',
    url: '/audit/events?entityType=payment&entityId=pay-rate-1',
    headers: {
      'x-user-id': 'rate-user-1'
    }
  });

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(third.statusCode, 429);
  assert.equal(third.json().error, 'rate_limit_exceeded');
  assert.equal(third.headers['retry-after'] !== undefined, true);

  await app.close();
});

