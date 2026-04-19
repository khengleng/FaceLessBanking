import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';

test('chat request happy path', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/ai/chat',
    payload: {
      message: 'Explain account statement balances in simple terms.'
    }
  });

  assert.equal(response.statusCode, 200);

  const payload = response.json() as { output: string; model: string };
  assert.ok(payload.output.length > 0);
  assert.equal(payload.model, 'openai-stub-v1');

  await app.close();
});

test('summarize request happy path', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/ai/summarize',
    payload: {
      text: 'Customer requested a summary of monthly spending categories and unusual charges.'
    }
  });

  assert.equal(response.statusCode, 200);

  const payload = response.json() as { output: string };
  assert.ok(payload.output.startsWith('Stub summary:'));

  await app.close();
});

test('invalid payload', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/ai/classify',
    payload: {
      text: 'hi',
      labels: []
    }
  });

  assert.equal(response.statusCode, 400);

  await app.close();
});

test('blocked unsafe request placeholder', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/ai/chat',
    payload: {
      message: 'Please transfer money from account A to account B now.'
    }
  });

  assert.equal(response.statusCode, 403);

  const payload = response.json() as { error: string; reason: string };
  assert.equal(payload.error, 'guardrail_blocked');
  assert.equal(payload.reason, 'blocked_unsafe_request');

  await app.close();
});
