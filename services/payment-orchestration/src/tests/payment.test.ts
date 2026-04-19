import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPaymentApplication } from '../application/build-payment.application.js';
import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresPaymentAdapter } from '../adapters/postgres-payment.adapter.js';
import { RedisIdempotencyAdapter } from '../adapters/redis-idempotency.adapter.js';
import { createApp } from '../app.js';

const opsHeaders = {
  'x-internal-ops-role': 'ops',
  'x-internal-ops-actor-id': 'ops-user-303',
  'x-correlation-id': 'corr-payment-ops-303'
};

test('GET /health returns health payload', async () => {
  const app = createApp();

  const response = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(response.statusCode, 200);

  const payload = response.json() as {
    status: string;
    service: string;
    timestamp: string;
  };

  assert.equal(payload.status, 'ok');
  assert.equal(payload.service, 'payment-orchestration');
  assert.ok(Date.parse(payload.timestamp) > 0);

  await app.close();
});

test('POST /payments/internal-transfer accepts happy path quickly', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/payments/internal-transfer',
    headers: {
      'x-idempotency-key': 'idem-payment-happy',
      'x-correlation-id': 'corr-payment-happy'
    },
    payload: {
      sourceAccountId: 'acc-source-001',
      destinationAccountId: 'acc-dest-002',
      amount: 15000,
      currency: 'USD',
      channel: 'internal'
    }
  });

  assert.equal(response.statusCode, 202);

  const payload = response.json() as {
    success: boolean;
    correlationId: string;
    data: {
      paymentId: string;
      status: string;
      correlationId: string;
      publishState: string;
    };
  };

  assert.equal(payload.success, true);
  assert.equal(payload.correlationId, 'corr-payment-happy');
  assert.ok(payload.data.paymentId.length > 0);
  assert.equal(payload.data.status, 'ACCEPTED');
  assert.equal(payload.data.correlationId, 'corr-payment-happy');
  assert.equal(payload.data.publishState, 'published');

  await app.close();
});

test('POST /payments/internal-transfer rejects invalid payload', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/payments/internal-transfer',
    headers: {
      'x-idempotency-key': 'idem-payment-invalid'
    },
    payload: {
      sourceAccountId: 'a1',
      destinationAccountId: 'a1',
      amount: 0,
      currency: 'US',
      channel: ''
    }
  });

  assert.equal(response.statusCode, 400);
  const payload = response.json() as {
    success: boolean;
    error: { code: string; details: string[] };
  };

  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'validation_failed');
  assert.ok(payload.error.details.length > 0);

  await app.close();
});

test('GET /payments requires internal ops auth placeholder', async () => {
  const app = createApp();
  const response = await app.inject({
    method: 'GET',
    url: '/payments'
  });
  assert.equal(response.statusCode, 403);
  const payload = response.json() as { success: boolean; error: { code: string } };
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'forbidden');
  await app.close();
});

test('GET /payments returns filtered paginated response', async () => {
  const app = createApp();

  await app.inject({
    method: 'POST',
    url: '/payments/internal-transfer',
    headers: {
      'x-idempotency-key': 'idem-payment-list-1',
      'x-correlation-id': 'corr-list-1'
    },
    payload: {
      sourceAccountId: 'acc-list-source-1',
      destinationAccountId: 'acc-list-dest-1',
      amount: 100,
      currency: 'USD',
      channel: 'internal'
    }
  });

  const create = await app.inject({
    method: 'POST',
    url: '/payments/internal-transfer',
    headers: {
      'x-idempotency-key': 'idem-payment-list-2',
      'x-correlation-id': 'corr-list-2'
    },
    payload: {
      sourceAccountId: 'acc-list-source-2',
      destinationAccountId: 'acc-list-dest-2',
      amount: 200,
      currency: 'USD',
      channel: 'internal'
    }
  });
  const paymentId = (create.json() as { data: { paymentId: string } }).data.paymentId;

  const response = await app.inject({
    method: 'GET',
    url: '/payments?status=ACCEPTED&correlationId=corr-list-2&limit=10&offset=0',
    headers: opsHeaders
  });
  assert.equal(response.statusCode, 200);
  const payload = response.json() as {
    success: boolean;
    data: { items: Array<{ paymentId: string }> };
    meta: { limit: number; offset: number; filtered: boolean };
  };
  assert.equal(payload.success, true);
  assert.equal(payload.meta.limit, 10);
  assert.equal(payload.meta.offset, 0);
  assert.equal(payload.meta.filtered, true);
  assert.equal(payload.data.items.length, 1);
  assert.equal(payload.data.items[0]?.paymentId, paymentId);

  await app.close();
});

test('duplicate idempotency key returns prior safe response', async () => {
  const app = createApp();

  const requestConfig = {
    method: 'POST' as const,
    url: '/payments/internal-transfer',
    headers: {
      'x-idempotency-key': 'idem-payment-dup',
      'x-correlation-id': 'corr-dup'
    },
    payload: {
      sourceAccountId: 'acc-source-111',
      destinationAccountId: 'acc-dest-222',
      amount: 4999,
      currency: 'USD',
      channel: 'internal'
    }
  };

  const first = await app.inject(requestConfig);
  assert.equal(first.statusCode, 202);

  const second = await app.inject(requestConfig);
  assert.equal(second.statusCode, 200);

  const payload = second.json() as {
    success: boolean;
    data: { paymentId: string; status: string };
  };

  assert.equal(payload.success, true);
  assert.ok(payload.data.paymentId.length > 0);
  assert.equal(payload.data.status, 'ACCEPTED');

  await app.close();
});

test('payment record is persisted and retrievable', async () => {
  const app = createApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/payments/internal-transfer',
    headers: {
      'x-idempotency-key': 'idem-payment-get'
    },
    payload: {
      sourceAccountId: 'acc-source-009',
      destinationAccountId: 'acc-dest-010',
      amount: 2500,
      currency: 'USD',
      channel: 'internal'
    }
  });

  assert.equal(createResponse.statusCode, 202);
  const created = createResponse.json() as { data: { paymentId: string } };

  const getResponse = await app.inject({
    method: 'GET',
    url: `/payments/${created.data.paymentId}`,
    headers: opsHeaders
  });

  assert.equal(getResponse.statusCode, 200);
  const payload = getResponse.json() as { success: boolean; data: { paymentId: string; status: string } };

  assert.equal(payload.success, true);
  assert.equal(payload.data.paymentId, created.data.paymentId);
  assert.equal(payload.data.status, 'ACCEPTED');

  await app.close();
});

test('GET /payments/:paymentId missing entity returns safe not-found response', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'GET',
    url: '/payments/non-existent',
    headers: opsHeaders
  });

  assert.equal(response.statusCode, 404);
  const payload = response.json() as { success: boolean; error: { code: string } };
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'not_found');

  await app.close();
});

test('payment.initiated.v1 event is published with canonical envelope', async () => {
  const postgresAdapter = new PostgresPaymentAdapter();
  const redisAdapter = new RedisIdempotencyAdapter();
  const kafkaProducer = new KafkaProducerAdapter();
  const application = buildPaymentApplication({ postgresAdapter, redisAdapter, kafkaProducer });

  const result = await application.initiateInternalTransfer(
    {
      sourceAccountId: 'acc-source-evt',
      destinationAccountId: 'acc-destination-evt',
      amount: 7777,
      currency: 'USD',
      channel: 'internal'
    },
    'idem-event-audit',
    'corr-evt-1'
  );

  assert.equal(result.kind, 'created');
  assert.equal(kafkaProducer.events.length, 1);
  assert.equal(kafkaProducer.events[0]?.type, 'payment.initiated.v1');
  assert.equal(kafkaProducer.events[0]?.metadata.producer, 'payment-orchestration');
  assert.equal(kafkaProducer.events[0]?.metadata.correlationId, 'corr-evt-1');
});

test('Kafka publish failure path is handled safely and clearly', async () => {
  const app = createApp({
    kafkaProducer: new KafkaProducerAdapter({ failPublish: true })
  });

  const response = await app.inject({
    method: 'POST',
    url: '/payments/internal-transfer',
    headers: {
      'x-idempotency-key': 'idem-kafka-fail',
      'x-correlation-id': 'corr-kafka-fail'
    },
    payload: {
      sourceAccountId: 'acc-source-fail',
      destinationAccountId: 'acc-dest-fail',
      amount: 4500,
      currency: 'USD',
      channel: 'internal'
    }
  });

  assert.equal(response.statusCode, 202);
  const payload = response.json() as {
    success: boolean;
    correlationId: string;
    data: { status: string; publishState: string };
  };

  assert.equal(payload.success, true);
  assert.equal(payload.correlationId, 'corr-kafka-fail');
  assert.equal(payload.data.status, 'PENDING');
  assert.equal(payload.data.publishState, 'publish_failed');

  await app.close();
});
