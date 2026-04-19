import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';

test('POST /support/tickets creates a support ticket', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/support/tickets',
    payload: {
      customerId: 'cust_12345',
      subject: 'Unable to view recent transactions'
    }
  });

  assert.equal(response.statusCode, 201);

  const payload = response.json() as {
    ticketId: string;
    customerId: string;
    subject: string;
    status: string;
    messages: unknown[];
  };

  assert.ok(payload.ticketId.length > 0);
  assert.equal(payload.customerId, 'cust_12345');
  assert.equal(payload.subject, 'Unable to view recent transactions');
  assert.equal(payload.status, 'open');
  assert.equal(payload.messages.length, 0);

  await app.close();
});

test('GET /support/tickets/:ticketId gets an existing ticket', async () => {
  const app = createApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/support/tickets',
    payload: {
      customerId: 'cust_abc',
      subject: 'Question about account statement'
    }
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json() as { ticketId: string; customerId: string };

  const getResponse = await app.inject({
    method: 'GET',
    url: `/support/tickets/${created.ticketId}`
  });

  assert.equal(getResponse.statusCode, 200);

  const payload = getResponse.json() as { ticketId: string; customerId: string; messages: unknown[] };
  assert.equal(payload.ticketId, created.ticketId);
  assert.equal(payload.customerId, 'cust_abc');
  assert.equal(payload.messages.length, 0);

  await app.close();
});

test('POST /support/tickets/:ticketId/messages adds a message to a ticket', async () => {
  const app = createApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/support/tickets',
    payload: {
      customerId: 'cust_777',
      subject: 'Mobile app login issue'
    }
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json() as { ticketId: string };

  const messageResponse = await app.inject({
    method: 'POST',
    url: `/support/tickets/${created.ticketId}/messages`,
    payload: {
      senderType: 'customer',
      message: 'I am seeing an invalid session error during login.'
    }
  });

  assert.equal(messageResponse.statusCode, 201);

  const payload = messageResponse.json() as {
    ticketId: string;
    messages: Array<{ senderType: string; message: string }>;
  };

  assert.equal(payload.ticketId, created.ticketId);
  assert.equal(payload.messages.length, 1);
  assert.equal(payload.messages[0]?.senderType, 'customer');
  assert.equal(payload.messages[0]?.message, 'I am seeing an invalid session error during login.');

  await app.close();
});

test('POST /support/tickets rejects invalid payload', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/support/tickets',
    payload: {
      customerId: 'ab',
      subject: ''
    }
  });

  assert.equal(response.statusCode, 400);

  const payload = response.json() as { error: string; details: string[] };
  assert.equal(payload.error, 'validation_failed');
  assert.ok(payload.details.length > 0);

  await app.close();
});
