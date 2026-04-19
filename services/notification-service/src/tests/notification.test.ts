import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';

test('POST /notifications creates notification', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/notifications',
    payload: {
      channel: 'sms',
      recipient: '+85512345678',
      message: 'Your transfer is complete.'
    }
  });

  assert.equal(response.statusCode, 201);

  const payload = response.json() as {
    notificationId: string;
    channel: string;
    recipient: string;
    status: string;
    providerMessageId: string;
  };

  assert.ok(payload.notificationId.length > 0);
  assert.equal(payload.channel, 'sms');
  assert.equal(payload.recipient, '+85512345678');
  assert.equal(payload.status, 'requested');
  assert.ok(payload.providerMessageId.startsWith('sms-'));

  await app.close();
});

test('POST /notifications rejects invalid channel', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/notifications',
    payload: {
      channel: 'fax',
      recipient: '+85512345678',
      message: 'Unsupported channel test'
    }
  });

  assert.equal(response.statusCode, 400);

  const payload = response.json() as {
    error: string;
    supportedChannels: string[];
  };

  assert.equal(payload.error, 'invalid_channel');
  assert.deepEqual(payload.supportedChannels, ['sms', 'email', 'push']);

  await app.close();
});

test('GET /notifications/:notificationId returns notification by id', async () => {
  const app = createApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/notifications',
    payload: {
      channel: 'email',
      recipient: 'user@example.com',
      message: 'Welcome to FaceLessBanking.'
    }
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json() as { notificationId: string; channel: string };

  const getResponse = await app.inject({
    method: 'GET',
    url: `/notifications/${created.notificationId}`
  });

  assert.equal(getResponse.statusCode, 200);

  const payload = getResponse.json() as { notificationId: string; channel: string };
  assert.equal(payload.notificationId, created.notificationId);
  assert.equal(payload.channel, 'email');

  await app.close();
});

test('POST /notifications rejects invalid payload', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/notifications',
    payload: {
      channel: 'push',
      recipient: 'ab',
      message: ''
    }
  });

  assert.equal(response.statusCode, 400);

  const payload = response.json() as {
    error: string;
    details: string[];
  };

  assert.equal(payload.error, 'validation_failed');
  assert.ok(payload.details.length > 0);

  await app.close();
});
