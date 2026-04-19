import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../app.js';
test('GET /health returns health payload and generated correlation id', async () => {
    const app = createApp();
    const response = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(response.statusCode, 200);
    assert.ok(response.headers['x-correlation-id']);
    const payload = response.json();
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
test('gateway placeholder echoes correlation id and returns 501 for authorized route', async () => {
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
    const payload = response.json();
    assert.equal(payload.correlationId, correlationId);
    assert.equal(payload.data.route, 'payments');
    assert.equal(payload.data.message, 'Gateway route placeholder');
    await app.close();
});
