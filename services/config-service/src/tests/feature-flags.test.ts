import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';

test('feature toggled on and off', async () => {
  const app = createApp();

  const initial = await app.inject({
    method: 'GET',
    url: '/features/new-onboarding-flow'
  });

  assert.equal(initial.statusCode, 200);
  assert.equal(initial.json().data.flagKey, 'new-onboarding-flow');
  assert.equal(initial.json().data.enabled, false);

  const enabled = await app.inject({
    method: 'POST',
    url: '/features/new-onboarding-flow',
    headers: {
      'idempotency-key': 'feature-toggle-enable-1'
    },
    payload: {
      enabled: true
    }
  });

  assert.equal(enabled.statusCode, 200);
  assert.equal(enabled.json().data.enabled, true);

  const afterEnable = await app.inject({
    method: 'GET',
    url: '/features/new-onboarding-flow'
  });

  assert.equal(afterEnable.statusCode, 200);
  assert.equal(afterEnable.json().data.enabled, true);

  const disabled = await app.inject({
    method: 'POST',
    url: '/features/new-onboarding-flow',
    headers: {
      'idempotency-key': 'feature-toggle-disable-1'
    },
    payload: {
      enabled: false
    }
  });

  assert.equal(disabled.statusCode, 200);
  assert.equal(disabled.json().data.enabled, false);

  const afterDisable = await app.inject({
    method: 'GET',
    url: '/features/new-onboarding-flow'
  });

  assert.equal(afterDisable.statusCode, 200);
  assert.equal(afterDisable.json().data.enabled, false);

  await app.close();
});

