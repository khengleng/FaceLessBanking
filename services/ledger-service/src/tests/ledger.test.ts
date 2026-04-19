import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';

test('create anchor request', async () => {
  const app = await createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/ledger/anchors',
    payload: {
      eventId: 'evt-12345',
      hash: 'abcdef1234567890fedcba',
      chain: 'ethereum'
    }
  });

  assert.equal(response.statusCode, 201);

  const payload = response.json() as {
    anchorId: string;
    eventId: string;
    status: string;
    transactionId: string;
  };

  assert.ok(payload.anchorId.length > 0);
  assert.equal(payload.eventId, 'evt-12345');
  assert.equal(payload.status, 'requested');
  assert.ok(payload.transactionId.startsWith('tx-'));

  await app.close();
});

test('get anchor status', async () => {
  const app = await createApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/ledger/anchors',
    payload: {
      eventId: 'evt-55555',
      hash: '1234567890abcdef123456',
      chain: 'polygon'
    }
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json() as { anchorId: string };

  const getResponse = await app.inject({
    method: 'GET',
    url: `/ledger/anchors/${created.anchorId}`
  });

  assert.equal(getResponse.statusCode, 200);

  const payload = getResponse.json() as {
    anchorId: string;
    status: string;
  };

  assert.equal(payload.anchorId, created.anchorId);
  assert.equal(payload.status, 'requested');

  await app.close();
});

test('get proof placeholder', async () => {
  const app = await createApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/ledger/anchors',
    payload: {
      eventId: 'evt-proof-1',
      hash: '9999999999aaaabbbbcccc',
      chain: 'ethereum'
    }
  });

  assert.equal(createResponse.statusCode, 201);

  const proofResponse = await app.inject({
    method: 'GET',
    url: '/ledger/proofs/evt-proof-1'
  });

  assert.equal(proofResponse.statusCode, 200);

  const payload = proofResponse.json() as {
    eventId: string;
    proofStatus: string;
    chain: string;
  };

  assert.equal(payload.eventId, 'evt-proof-1');
  assert.equal(payload.proofStatus, 'available');
  assert.equal(payload.chain, 'ethereum');

  await app.close();
});

test('invalid payload', async () => {
  const app = await createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/ledger/anchors',
    payload: {
      eventId: 'x',
      hash: 'short',
      chain: ''
    }
  });

  assert.equal(response.statusCode, 400);

  await app.close();
});
