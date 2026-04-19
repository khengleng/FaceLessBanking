import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';

test('config updated dynamically and reflected by GET /config', async () => {
  const app = createApp();

  const initial = await app.inject({ method: 'GET', url: '/config' });
  assert.equal(initial.statusCode, 200);
  assert.deepEqual(initial.json().data.entries, []);

  const update = await app.inject({
    method: 'POST',
    url: '/config',
    headers: {
      'idempotency-key': 'cfg-update-1',
      'x-actor-id': 'ops-user-1'
    },
    payload: {
      key: 'defaultCurrency',
      value: 'USD',
      reason: 'set default currency'
    }
  });

  assert.equal(update.statusCode, 200);
  assert.equal(update.json().data.key, 'defaultCurrency');
  assert.equal(update.json().data.value, 'USD');
  assert.equal(update.json().data.version, 1);

  const byKey = await app.inject({ method: 'GET', url: '/config/defaultCurrency' });
  assert.equal(byKey.statusCode, 200);
  assert.equal(byKey.json().data.key, 'defaultCurrency');
  assert.equal(byKey.json().data.value, 'USD');

  const latest = await app.inject({ method: 'GET', url: '/config' });
  assert.equal(latest.statusCode, 200);
  assert.equal(latest.json().data.entries.length, 1);
  assert.equal(latest.json().data.entries[0].key, 'defaultCurrency');
  assert.equal(latest.json().data.entries[0].value, 'USD');

  await app.close();
});

test('duplicate update blocked by idempotency key', async () => {
  const app = createApp();

  const payload = {
    key: 'notificationEnabled',
    value: true,
    reason: 'enable notifications'
  };

  const first = await app.inject({
    method: 'POST',
    url: '/config',
    headers: {
      'idempotency-key': 'cfg-dup-1',
      'x-actor-id': 'ops-user-2'
    },
    payload
  });

  assert.equal(first.statusCode, 200);

  const duplicate = await app.inject({
    method: 'POST',
    url: '/config',
    headers: {
      'idempotency-key': 'cfg-dup-1',
      'x-actor-id': 'ops-user-2'
    },
    payload
  });

  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().error, 'duplicate_request');

  await app.close();
});

test('unsafe secret-like values are masked in responses', async () => {
  const app = createApp();

  const update = await app.inject({
    method: 'POST',
    url: '/config',
    headers: {
      'idempotency-key': 'cfg-secret-1',
      'x-actor-id': 'ops-user-3'
    },
    payload: {
      key: 'payments.apiKey',
      value: 'super-secret-key',
      reason: 'configure provider key'
    }
  });

  assert.equal(update.statusCode, 200);
  assert.equal(update.json().data.key, 'payments.apiKey');
  assert.equal(update.json().data.value, '***REDACTED***');

  const byKey = await app.inject({ method: 'GET', url: '/config/payments.apiKey' });
  assert.equal(byKey.statusCode, 200);
  assert.equal(byKey.json().data.value, '***REDACTED***');

  await app.close();
});
