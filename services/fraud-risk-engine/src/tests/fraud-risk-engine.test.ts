import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';

test('POST /risk/score scores risk request', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/risk/score',
    payload: {
      riskType: 'transfer',
      context: {
        amount: 6000,
        highVelocity: true
      }
    }
  });

  assert.equal(response.statusCode, 200);

  const payload = response.json() as {
    riskType: string;
    score: number;
    level: string;
    reasons: string[];
  };

  assert.equal(payload.riskType, 'transfer');
  assert.equal(payload.level, 'high');
  assert.ok(payload.score >= 70);
  assert.ok(payload.reasons.length > 0);

  await app.close();
});

test('POST /risk/alerts creates alert', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/risk/alerts',
    payload: {
      riskType: 'onboarding',
      entityId: 'cust_987',
      severity: 'medium',
      reason: 'Document mismatch signal'
    }
  });

  assert.equal(response.statusCode, 201);

  const payload = response.json() as {
    alertId: string;
    riskType: string;
    status: string;
    severity: string;
  };

  assert.ok(payload.alertId.length > 0);
  assert.equal(payload.riskType, 'onboarding');
  assert.equal(payload.status, 'open');
  assert.equal(payload.severity, 'medium');

  await app.close();
});

test('GET /risk/alerts/:alertId returns existing alert', async () => {
  const app = createApp();

  const created = await app.inject({
    method: 'POST',
    url: '/risk/alerts',
    payload: {
      riskType: 'loan',
      entityId: 'loan_123',
      severity: 'high',
      reason: 'Debt to income anomaly'
    }
  });

  assert.equal(created.statusCode, 201);
  const createdPayload = created.json() as { alertId: string };

  const response = await app.inject({
    method: 'GET',
    url: `/risk/alerts/${createdPayload.alertId}`
  });

  assert.equal(response.statusCode, 200);

  const payload = response.json() as { alertId: string; riskType: string; severity: string };
  assert.equal(payload.alertId, createdPayload.alertId);
  assert.equal(payload.riskType, 'loan');
  assert.equal(payload.severity, 'high');

  await app.close();
});

test('POST /risk/alerts rejects invalid payload', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/risk/alerts',
    payload: {
      riskType: 'invalid',
      entityId: 'ab',
      severity: 'critical',
      reason: 'x'
    }
  });

  assert.equal(response.statusCode, 400);

  const payload = response.json() as { error: string; details: string[] };
  assert.equal(payload.error, 'validation_failed');
  assert.ok(payload.details.length > 0);

  await app.close();
});
