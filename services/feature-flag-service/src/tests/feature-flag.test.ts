import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';

test('feature toggled', async () => {
  const app = createApp();

  const create = await app.inject({
    method: 'POST',
    url: '/feature-flags',
    headers: {
      'idempotency-key': 'flag-toggle-create'
    },
    payload: {
      flagKey: 'new-checkout',
      description: 'Enable new checkout flow',
      enabled: true,
      environments: ['staging', 'prod'],
      roles: ['ops', 'admin']
    }
  });

  assert.equal(create.statusCode, 200);
  assert.equal(create.json().data.enabled, true);

  const update = await app.inject({
    method: 'POST',
    url: '/feature-flags',
    headers: {
      'idempotency-key': 'flag-toggle-update'
    },
    payload: {
      flagKey: 'new-checkout',
      description: 'Enable new checkout flow',
      enabled: false,
      environments: ['staging', 'prod'],
      roles: ['ops', 'admin']
    }
  });

  assert.equal(update.statusCode, 200);
  assert.equal(update.json().data.enabled, false);

  await app.close();
});

test('retrieval works', async () => {
  const app = createApp();

  await app.inject({
    method: 'POST',
    url: '/feature-flags',
    headers: {
      'idempotency-key': 'flag-retrieve-create'
    },
    payload: {
      flagKey: 'new-transfer-limit',
      description: 'Enable transfer limit UX',
      enabled: true,
      environments: ['prod'],
      roles: ['admin']
    }
  });

  const byKey = await app.inject({
    method: 'GET',
    url: '/feature-flags/new-transfer-limit'
  });

  assert.equal(byKey.statusCode, 200);
  assert.equal(byKey.json().data.flagKey, 'new-transfer-limit');
  assert.equal(byKey.json().data.enabled, true);

  const list = await app.inject({
    method: 'GET',
    url: '/feature-flags'
  });

  assert.equal(list.statusCode, 200);
  assert.equal(Array.isArray(list.json().data.items), true);
  assert.equal(list.json().data.items.length, 1);

  await app.close();
});

test('invalid flag rejected safely', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/feature-flags',
    headers: {
      'idempotency-key': 'flag-invalid'
    },
    payload: {
      flagKey: 'x',
      description: 'x',
      enabled: 'true',
      environments: 'prod',
      roles: ['ops']
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().success, false);
  assert.equal(response.json().error, 'validation_failed');

  await app.close();
});
