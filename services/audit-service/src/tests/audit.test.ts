import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';

test('create audit event', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/audit/events',
    headers: {
      'idempotency-key': 'idem-create-audit-event',
      'x-user-id': 'test-user-1'
    },
    payload: {
      eventType: 'payment.initiated',
      correlationId: 'corr-123',
      entityType: 'payment',
      entityId: 'pay-001',
      payload: { amountCents: 1000, currency: 'USD' },
      actor: {
        actorId: 'user-1',
        actorType: 'customer'
      }
    }
  });

  assert.equal(response.statusCode, 201);
  const body = response.json() as {
    auditId: string;
    sourceEventId: string;
    eventId: string;
    eventType: string;
    entityId: string;
    checksum: string;
  };

  assert.ok(body.auditId.length > 0);
  assert.ok(body.sourceEventId.length > 0);
  assert.ok(body.eventId.length > 0);
  assert.equal(body.eventType, 'payment.initiated');
  assert.equal(body.entityId, 'pay-001');
  assert.ok(body.checksum.length > 0);

  await app.close();
});

test('get audit by id', async () => {
  const app = createApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/audit/events',
    headers: {
      'idempotency-key': 'idem-get-audit-by-id',
      'x-user-id': 'test-user-2'
    },
    payload: {
      eventType: 'account.opened',
      correlationId: 'corr-456',
      entityType: 'account',
      entityId: 'acc-123',
      payload: { productCode: 'SV' },
      actor: {
        actorId: 'user-2',
        actorType: 'staff'
      }
    }
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json() as { eventId: string };

  const getResponse = await app.inject({
    method: 'GET',
    url: `/audit/events/${created.eventId}`
  });

  assert.equal(getResponse.statusCode, 200);
  const body = getResponse.json() as { eventId: string; entityType: string };

  assert.equal(body.eventId, created.eventId);
  assert.equal(body.entityType, 'account');

  await app.close();
});

test('query audit by entity', async () => {
  const app = createApp();

  const payloadBase = {
    eventType: 'loan.updated',
    correlationId: 'corr-789',
    entityType: 'loan',
    entityId: 'loan-abc',
    payload: { status: 'under_review' },
    actor: {
      actorId: 'system-1',
      actorType: 'system'
    }
  };

  const createA = await app.inject({
    method: 'POST',
    url: '/audit/events',
    headers: {
      'idempotency-key': 'idem-query-a',
      'x-user-id': 'test-user-3'
    },
    payload: payloadBase
  });
  const createB = await app.inject({
    method: 'POST',
    url: '/audit/events',
    headers: {
      'idempotency-key': 'idem-query-b',
      'x-user-id': 'test-user-3'
    },
    payload: payloadBase
  });

  assert.equal(createA.statusCode, 201);
  assert.equal(createB.statusCode, 201);

  const queryResponse = await app.inject({
    method: 'GET',
    url: '/audit/events?entityType=loan&entityId=loan-abc'
  });

  assert.equal(queryResponse.statusCode, 200);
  const body = queryResponse.json() as { items: Array<{ entityId: string }> };

  assert.ok(body.items.length >= 2);
  for (const item of body.items) {
    assert.equal(item.entityId, 'loan-abc');
  }

  await app.close();
});

test('query audit by correlationId and sourceEventId', async () => {
  const app = createApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/audit/events',
    headers: {
      'idempotency-key': 'idem-query-corr-source',
      'x-user-id': 'test-user-5'
    },
    payload: {
      sourceEventId: 'src-event-manual-123',
      eventType: 'payment.status.updated.v1',
      correlationId: 'corr-query-123',
      entityType: 'payment',
      entityId: 'pay-query-123',
      payload: { status: 'COMPLETED' },
      actor: {
        actorId: 'ops-1',
        actorType: 'staff'
      }
    }
  });

  assert.equal(createResponse.statusCode, 201);

  const correlationQuery = await app.inject({
    method: 'GET',
    url: '/audit/events?correlationId=corr-query-123'
  });

  assert.equal(correlationQuery.statusCode, 200);
  const byCorrelation = correlationQuery.json() as { items: Array<{ correlationId: string }> };
  assert.equal(byCorrelation.items.length, 1);
  assert.equal(byCorrelation.items[0]?.correlationId, 'corr-query-123');

  const sourceEventQuery = await app.inject({
    method: 'GET',
    url: '/audit/events?sourceEventId=src-event-manual-123'
  });

  assert.equal(sourceEventQuery.statusCode, 200);
  const bySource = sourceEventQuery.json() as {
    items: Array<{ sourceEventId: string; entityId: string }>;
  };
  assert.equal(bySource.items.length, 1);
  assert.equal(bySource.items[0]?.sourceEventId, 'src-event-manual-123');
  assert.equal(bySource.items[0]?.entityId, 'pay-query-123');

  await app.close();
});

test('invalid payload', async () => {
  const app = createApp();

  const invalidCreate = await app.inject({
    method: 'POST',
    url: '/audit/events',
    headers: {
      'idempotency-key': 'idem-invalid-payload',
      'x-user-id': 'test-user-4'
    },
    payload: {
      eventType: 'x',
      correlationId: '',
      entityType: '',
      entityId: '',
      payload: [],
      actor: {
        actorId: '',
        actorType: ''
      }
    }
  });

  assert.equal(invalidCreate.statusCode, 400);

  const invalidQuery = await app.inject({ method: 'GET', url: '/audit/events?entityType=&entityId=' });
  assert.equal(invalidQuery.statusCode, 400);

  await app.close();
});

test('no update or delete paths exist for audit events', async () => {
  const app = createApp();

  const updateResponse = await app.inject({
    method: 'PUT',
    url: '/audit/events/event-123',
    payload: {
      payload: { attempt: 'mutate' }
    }
  });
  assert.equal(updateResponse.statusCode >= 400, true);

  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: '/audit/events/event-123'
  });
  assert.equal(deleteResponse.statusCode >= 400, true);

  await app.close();
});
