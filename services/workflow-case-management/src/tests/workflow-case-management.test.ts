import assert from 'node:assert/strict';
import test from 'node:test';

import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { createApp } from '../app.js';
import { buildCase } from '../domain/case.js';
import { CaseEventsPublisher } from '../events/case.events.js';

const opsHeaders = {
  'x-internal-ops-role': 'ops',
  'x-internal-ops-actor-id': 'ops-user-100',
  'x-correlation-id': 'corr-workflow-100'
};

test('GET /cases/onboarding-review lists onboarding queue with status filter', async () => {
  const app = createApp();

  await app.inject({
    method: 'POST',
    url: '/cases',
    payload: {
      caseType: 'onboarding-review',
      referenceId: 'cust_456'
    }
  });

  await app.inject({
    method: 'POST',
    url: '/cases',
    payload: {
      caseType: 'onboarding-review',
      referenceId: 'cust_789'
    }
  });

  const response = await app.inject({
    method: 'GET',
    url: '/cases/onboarding-review?status=NEW&limit=10&offset=0',
    headers: opsHeaders
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as {
    success: boolean;
    data: {
      items: Array<{ caseType: string; status: string }>;
      limit: number;
      offset: number;
    };
  };
  assert.equal(payload.success, true);
  assert.equal(payload.data.limit, 10);
  assert.equal(payload.data.offset, 0);
  assert.ok(payload.data.items.every((item) => item.caseType === 'onboarding-review'));
  assert.ok(payload.data.items.every((item) => item.status === 'NEW'));

  await app.close();
});

test('GET /cases/:caseId gets case with standardized envelope', async () => {
  const app = createApp();

  const created = await app.inject({
    method: 'POST',
    url: '/cases',
    payload: {
      caseType: 'onboarding-review',
      referenceId: 'cust_1001'
    }
  });

  assert.equal(created.statusCode, 201);
  const createdPayload = created.json() as { data: { caseId: string } };

  const response = await app.inject({
    method: 'GET',
    url: `/cases/${createdPayload.data.caseId}`,
    headers: opsHeaders
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as {
    success: boolean;
    data: { caseId: string; caseType: string; status: string };
  };
  assert.equal(payload.success, true);
  assert.equal(payload.data.caseId, createdPayload.data.caseId);
  assert.equal(payload.data.caseType, 'onboarding-review');
  assert.equal(payload.data.status, 'NEW');

  await app.close();
});

test('POST /cases/:caseId/actions supports REQUEST_REVIEW -> IN_REVIEW', async () => {
  const app = createApp();

  const created = await app.inject({
    method: 'POST',
    url: '/cases',
    payload: {
      caseType: 'onboarding-review',
      referenceId: 'cust_2001'
    }
  });

  assert.equal(created.statusCode, 201);
  const createdPayload = created.json() as { data: { caseId: string } };

  const response = await app.inject({
    method: 'POST',
    url: `/cases/${createdPayload.data.caseId}/actions`,
    headers: opsHeaders,
    payload: {
      actionType: 'REQUEST_REVIEW',
      reason: 'Needs analyst review'
    }
  });

  assert.equal(response.statusCode, 201);

  const payload = response.json() as {
    success: boolean;
    data: {
      caseId: string;
      status: string;
      updatedAt: string;
      actions: Array<{ actionType: string; actorId: string; newStatus: string }>;
    };
  };

  assert.equal(payload.success, true);
  assert.equal(payload.data.caseId, createdPayload.data.caseId);
  assert.equal(payload.data.status, 'IN_REVIEW');
  assert.ok(payload.data.updatedAt.length > 0);
  assert.equal(payload.data.actions.length, 1);
  assert.equal(payload.data.actions[0]?.actionType, 'REQUEST_REVIEW');
  assert.equal(payload.data.actions[0]?.actorId, 'ops-user-100');
  assert.equal(payload.data.actions[0]?.newStatus, 'IN_REVIEW');

  await app.close();
});

test('POST /cases/:caseId/actions blocks invalid transition safely', async () => {
  const app = createApp();

  const created = await app.inject({
    method: 'POST',
    url: '/cases',
    payload: {
      caseType: 'onboarding-review',
      referenceId: 'cust_3001'
    }
  });

  assert.equal(created.statusCode, 201);
  const createdPayload = created.json() as { data: { caseId: string } };

  const approve = await app.inject({
    method: 'POST',
    url: `/cases/${createdPayload.data.caseId}/actions`,
    headers: opsHeaders,
    payload: {
      actionType: 'APPROVE'
    }
  });

  assert.equal(approve.statusCode, 409);
  const payload = approve.json() as {
    success: boolean;
    error: { code: string; message: string; details: string[] };
  };
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'conflict');
  assert.ok(payload.error.details.length > 0);

  await app.close();
});

test('POST /cases/:caseId/actions replays same status safely without duplicate action', async () => {
  const app = createApp();

  const created = await app.inject({
    method: 'POST',
    url: '/cases',
    payload: {
      caseType: 'onboarding-review',
      referenceId: 'cust_4001'
    }
  });

  assert.equal(created.statusCode, 201);
  const createdPayload = created.json() as { data: { caseId: string } };

  const first = await app.inject({
    method: 'POST',
    url: `/cases/${createdPayload.data.caseId}/actions`,
    headers: opsHeaders,
    payload: {
      actionType: 'REQUEST_REVIEW'
    }
  });
  assert.equal(first.statusCode, 201);

  const second = await app.inject({
    method: 'POST',
    url: `/cases/${createdPayload.data.caseId}/actions`,
    headers: opsHeaders,
    payload: {
      actionType: 'REQUEST_REVIEW'
    }
  });
  assert.equal(second.statusCode, 200);
  const payload = second.json() as {
    success: boolean;
    data: { actions: Array<{ actionType: string }> };
  };
  assert.equal(payload.success, true);
  assert.equal(payload.data.actions.length, 1);

  await app.close();
});

test('GET /cases/onboarding-review rejects non-ops authorization', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'GET',
    url: '/cases/onboarding-review',
    headers: {
      'x-internal-ops-role': 'customer',
      'x-internal-ops-actor-id': 'user-1'
    }
  });

  assert.equal(response.statusCode, 403);
  const payload = response.json() as { success: boolean; error: { code: string } };
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'forbidden');

  await app.close();
});

test('case.created.v1 event is constructed and published', async () => {
  const kafkaProducer = new KafkaProducerAdapter();
  const publisher = new CaseEventsPublisher(kafkaProducer);

  const record = buildCase({
    caseId: 'case-evt-1',
    caseType: 'onboarding-review',
    referenceId: 'cust-evt-1',
    createdAt: new Date().toISOString()
  });

  await publisher.emitCaseCreated(record);

  assert.equal(kafkaProducer.events.length, 1);
  assert.equal(kafkaProducer.events[0]?.eventName, 'case.created.v1');
  assert.equal(kafkaProducer.events[0]?.aggregateId, record.caseId);
});
