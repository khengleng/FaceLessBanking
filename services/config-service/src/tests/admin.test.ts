import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';

test('GET /admin/system-health returns runtime visibility', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'GET',
    url: '/admin/system-health'
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as {
    success: boolean;
    data: {
      status: string;
      uptimeSeconds: number;
      timestamp: string;
    };
  };

  assert.equal(body.success, true);
  assert.equal(body.data.status, 'OK');
  assert.equal(typeof body.data.uptimeSeconds, 'number');
  assert.equal(body.data.uptimeSeconds >= 0, true);
  assert.equal(typeof body.data.timestamp, 'string');

  await app.close();
});

test('GET /admin/services returns service visibility', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'GET',
    url: '/admin/services'
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as {
    success: boolean;
    data: {
      items: Array<{
        serviceName: string;
        status: string;
        endpoints: string[];
      }>;
    };
  };

  assert.equal(body.success, true);
  assert.equal(Array.isArray(body.data.items), true);
  assert.equal(body.data.items.length > 0, true);
  assert.equal(body.data.items[0]?.serviceName, 'config-service');
  assert.equal(body.data.items[0]?.status, 'UP');
  assert.equal(body.data.items[0]?.endpoints.includes('/config'), true);
  assert.equal(body.data.items[0]?.endpoints.includes('/admin/errors'), true);

  await app.close();
});

test('GET /admin/errors returns error visibility view', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'GET',
    url: '/admin/errors'
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as {
    success: boolean;
    data: {
      items: unknown[];
    };
  };

  assert.equal(body.success, true);
  assert.equal(Array.isArray(body.data.items), true);

  await app.close();
});

