import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';

const ADMIN_TOKEN = 'test-admin-token';

function authHeaders() {
  return {
    'x-internal-admin-token': ADMIN_TOKEN
  };
}

test('system visibility works', async () => {
  const app = createApp(ADMIN_TOKEN);

  const health = await app.inject({
    method: 'GET',
    url: '/admin/system-health',
    headers: authHeaders()
  });
  assert.equal(health.statusCode, 200);
  const healthBody = health.json() as {
    success: boolean;
    data: {
      status: string;
      uptimeSeconds: number;
      timestamp: string;
    };
  };
  assert.equal(healthBody.success, true);
  assert.equal(healthBody.data.status, 'OK');
  assert.equal(typeof healthBody.data.uptimeSeconds, 'number');
  assert.equal(typeof healthBody.data.timestamp, 'string');

  const services = await app.inject({
    method: 'GET',
    url: '/admin/services',
    headers: authHeaders()
  });
  assert.equal(services.statusCode, 200);
  const servicesBody = services.json() as {
    success: boolean;
    data: {
      items: Array<{ serviceName: string; status: string }>;
    };
  };
  assert.equal(servicesBody.success, true);
  assert.equal(servicesBody.data.items.length > 0, true);
  assert.equal(typeof servicesBody.data.items[0]?.serviceName, 'string');

  const errors = await app.inject({
    method: 'GET',
    url: '/admin/errors',
    headers: authHeaders()
  });
  assert.equal(errors.statusCode, 200);
  const errorsBody = errors.json() as {
    success: boolean;
    data: {
      items: Array<Record<string, unknown>>;
    };
  };
  assert.equal(errorsBody.success, true);
  assert.equal(Array.isArray(errorsBody.data.items), true);

  if (errorsBody.data.items.length > 0) {
    const first = errorsBody.data.items[0] as Record<string, unknown>;
    assert.equal(first.stackTrace, undefined);
    assert.equal(first.secret, undefined);
    assert.equal(first.token, undefined);
  }

  await app.close();
});

test('endpoints are guarded', async () => {
  const app = createApp(ADMIN_TOKEN);

  const routes = [
    '/admin/system-health',
    '/admin/services',
    '/admin/errors'
  ];

  for (const route of routes) {
    const unauthorized = await app.inject({ method: 'GET', url: route });
    assert.equal(unauthorized.statusCode, 401);
    assert.equal(unauthorized.json().error, 'unauthorized');
  }

  await app.close();
});
