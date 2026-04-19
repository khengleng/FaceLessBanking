import assert from 'node:assert/strict';
import test from 'node:test';

import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { createApp } from '../app.js';
import { buildAccount } from '../domain/account.js';
import { AccountEventsPublisher } from '../events/account.events.js';

const opsHeaders = {
  'x-internal-ops-role': 'ops',
  'x-internal-ops-actor-id': 'ops-user-202',
  'x-correlation-id': 'corr-account-ops-202'
};

test('POST /accounts creates account on happy path', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/accounts',
    headers: {
      'x-idempotency-key': 'idem-account-happy'
    },
    payload: {
      customerId: 'cust-123',
      productCode: 'SV',
      currency: 'USD',
      initialDepositCents: 250000
    }
  });

  assert.equal(response.statusCode, 201);

  const payload = response.json() as {
    success: boolean;
    data: {
      accountId: string;
      customerId: string;
      status: string;
      externalAccountId: string;
    };
  };

  assert.equal(payload.success, true);
  assert.ok(payload.data.accountId.length > 0);
  assert.equal(payload.data.customerId, 'cust-123');
  assert.equal(payload.data.status, 'PENDING_ACTIVATION');
  assert.ok(payload.data.externalAccountId.startsWith('fineract-'));

  await app.close();
});

test('POST /accounts rejects invalid payload', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/accounts',
    headers: {
      'x-idempotency-key': 'idem-account-invalid'
    },
    payload: {
      customerId: 'x',
      productCode: '',
      currency: 'US',
      initialDepositCents: -10
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

test('GET /accounts requires internal ops auth placeholder', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'GET',
    url: '/accounts'
  });

  assert.equal(response.statusCode, 403);
  const payload = response.json() as { success: boolean; error: { code: string } };
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'forbidden');

  await app.close();
});

test('GET /accounts returns filtered paginated results', async () => {
  const app = createApp();

  await app.inject({
    method: 'POST',
    url: '/accounts',
    headers: { 'x-idempotency-key': 'idem-account-list-1' },
    payload: {
      customerId: 'cust-list-1',
      productCode: 'SV',
      currency: 'USD',
      initialDepositCents: 100
    }
  });

  const created = await app.inject({
    method: 'POST',
    url: '/accounts',
    headers: { 'x-idempotency-key': 'idem-account-list-2' },
    payload: {
      customerId: 'cust-list-2',
      productCode: 'SV',
      currency: 'USD',
      initialDepositCents: 200
    }
  });
  const createdPayload = created.json() as { data: { accountId: string } };

  const response = await app.inject({
    method: 'GET',
    url: `/accounts?accountId=${createdPayload.data.accountId}&limit=10&offset=0`,
    headers: opsHeaders
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as {
    success: boolean;
    data: { items: Array<{ accountId: string }> };
    meta: { limit: number; offset: number; filtered: boolean };
  };

  assert.equal(payload.success, true);
  assert.equal(payload.meta.limit, 10);
  assert.equal(payload.meta.offset, 0);
  assert.equal(payload.meta.filtered, true);
  assert.equal(payload.data.items.length, 1);
  assert.equal(payload.data.items[0]?.accountId, createdPayload.data.accountId);

  await app.close();
});

test('GET /accounts/:accountId returns account detail', async () => {
  const app = createApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/accounts',
    headers: {
      'x-idempotency-key': 'idem-account-get'
    },
    payload: {
      customerId: 'cust-456',
      productCode: 'CR',
      currency: 'USD',
      initialDepositCents: 1000
    }
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json() as { data: { accountId: string; customerId: string } };

  const getResponse = await app.inject({
    method: 'GET',
    url: `/accounts/${created.data.accountId}`,
    headers: opsHeaders
  });

  assert.equal(getResponse.statusCode, 200);
  const payload = getResponse.json() as {
    success: boolean;
    data: { accountId: string; customerId: string };
  };

  assert.equal(payload.success, true);
  assert.equal(payload.data.accountId, created.data.accountId);
  assert.equal(payload.data.customerId, 'cust-456');

  await app.close();
});

test('GET /accounts/:accountId missing account returns safe not-found response', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'GET',
    url: '/accounts/non-existent',
    headers: opsHeaders
  });

  assert.equal(response.statusCode, 404);
  const payload = response.json() as { success: boolean; error: { code: string } };
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'not_found');

  await app.close();
});

test('GET /accounts/:accountId/balance returns account balance', async () => {
  const app = createApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/accounts',
    headers: {
      'x-idempotency-key': 'idem-account-balance'
    },
    payload: {
      customerId: 'cust-789',
      productCode: 'SV',
      currency: 'USD',
      initialDepositCents: 5123
    }
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json() as { data: { accountId: string } };

  const balanceResponse = await app.inject({
    method: 'GET',
    url: `/accounts/${created.data.accountId}/balance`
  });

  assert.equal(balanceResponse.statusCode, 200);
  const payload = balanceResponse.json() as {
    success: boolean;
    data: {
      accountId: string;
      availableBalanceCents: number;
      ledgerBalanceCents: number;
      currency: string;
    };
  };

  assert.equal(payload.success, true);
  assert.equal(payload.data.accountId, created.data.accountId);
  assert.equal(payload.data.availableBalanceCents, 5123);
  assert.equal(payload.data.ledgerBalanceCents, 5123);
  assert.equal(payload.data.currency, 'USD');

  await app.close();
});

test('POST /accounts returns duplicate idempotency placeholder behavior', async () => {
  const app = createApp();

  const requestConfig = {
    method: 'POST' as const,
    url: '/accounts',
    headers: {
      'x-idempotency-key': 'idem-account-dup'
    },
    payload: {
      customerId: 'cust-999',
      productCode: 'SV',
      currency: 'USD',
      initialDepositCents: 200
    }
  };

  const first = await app.inject(requestConfig);
  assert.equal(first.statusCode, 201);

  const second = await app.inject(requestConfig);
  assert.equal(second.statusCode, 409);

  const payload = second.json() as {
    success: boolean;
    error: { code: string };
  };

  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'conflict');

  await app.close();
});

test('account.created.v1 event is constructed and published with canonical envelope', async () => {
  const kafkaProducer = new KafkaProducerAdapter();
  const publisher = new AccountEventsPublisher(kafkaProducer);

  const account = buildAccount({
    accountId: 'acc-evt-1',
    customerId: 'cust-evt-1',
    productCode: 'SV',
    currency: 'USD',
    createdAt: new Date().toISOString(),
    externalAccountId: 'fineract-evt-1',
    openingBalanceCents: 1000
  });

  await publisher.emitAccountCreated(account);

  assert.equal(kafkaProducer.events.length, 1);
  assert.equal(kafkaProducer.events[0]?.type, 'account.created.v1');
  assert.equal(kafkaProducer.events[0]?.version, 1);
  assert.equal(kafkaProducer.events[0]?.metadata.producer, 'account-service');
  assert.equal(kafkaProducer.events[0]?.payload.accountId, account.accountId);
});
