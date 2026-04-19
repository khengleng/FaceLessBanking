import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';

test('POST /rules/definitions creates rule definition', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/rules/definitions',
    payload: {
      category: 'transfer-limit',
      name: 'Default transfer limit',
      config: { limit: 1000 }
    }
  });

  assert.equal(response.statusCode, 201);

  const payload = response.json() as {
    ruleId: string;
    category: string;
    name: string;
  };

  assert.ok(payload.ruleId.length > 0);
  assert.equal(payload.category, 'transfer-limit');
  assert.equal(payload.name, 'Default transfer limit');

  await app.close();
});

test('POST /rules/evaluate evaluates a rule definition', async () => {
  const app = createApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/rules/definitions',
    payload: {
      category: 'transfer-limit',
      name: 'Tight transfer limit',
      config: { limit: 500 }
    }
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json() as { ruleId: string };

  const evaluateResponse = await app.inject({
    method: 'POST',
    url: '/rules/evaluate',
    payload: {
      category: 'transfer-limit',
      ruleId: created.ruleId,
      facts: { amount: 450 }
    }
  });

  assert.equal(evaluateResponse.statusCode, 200);

  const payload = evaluateResponse.json() as {
    ruleId: string;
    category: string;
    decision: string;
    reason: string;
  };

  assert.equal(payload.ruleId, created.ruleId);
  assert.equal(payload.category, 'transfer-limit');
  assert.equal(payload.decision, 'allow');
  assert.equal(payload.reason, 'within_transfer_limit');

  await app.close();
});

test('GET /rules/definitions/:ruleId returns existing definition', async () => {
  const app = createApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/rules/definitions',
    payload: {
      category: 'loan-eligibility',
      name: 'Loan baseline',
      config: { minCreditScore: 650 }
    }
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json() as { ruleId: string; category: string };

  const getResponse = await app.inject({
    method: 'GET',
    url: `/rules/definitions/${created.ruleId}`
  });

  assert.equal(getResponse.statusCode, 200);

  const payload = getResponse.json() as { ruleId: string; category: string; name: string };
  assert.equal(payload.ruleId, created.ruleId);
  assert.equal(payload.category, 'loan-eligibility');
  assert.equal(payload.name, 'Loan baseline');

  await app.close();
});

test('POST /rules/definitions rejects invalid payload', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/rules/definitions',
    payload: {
      category: 'unsupported-rule',
      name: 'ab'
    }
  });

  assert.equal(response.statusCode, 400);

  const payload = response.json() as { error: string; details: string[] };
  assert.equal(payload.error, 'validation_failed');
  assert.ok(payload.details.length > 0);

  await app.close();
});
