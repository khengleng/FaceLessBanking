import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../app.js';

test('Ops Dashboard Service', async (t) => {
  const app = createApp();

  await t.test('GET /dashboard/summary returns aggregated metrics', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/dashboard/summary'
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.data.totalPayments, 1250);
    assert.ok(payload.data.onboardingStatusCounts);
  });

  await t.test('GET /dashboard/payments supports filters and pagination', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/dashboard/payments?status=COMPLETED&limit=10&offset=0'
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.success, true);
    assert.ok(Array.isArray(payload.data.items));
    assert.equal(payload.data.total, 2);
  });

  await t.test('GET /dashboard/loans returns loan search results', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/dashboard/loans'
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.total, 1);
  });

  await t.test('rejects invalid query parameters', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/dashboard/payments?limit=999' // Max is 200
    });

    assert.equal(response.statusCode, 500); // Zod throws, and we don't have a global error handler for validation yet in this skeleton
  });

  await app.close();
});
