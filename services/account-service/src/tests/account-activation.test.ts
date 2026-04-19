import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAccountApplication } from '../application/build-account.application.js';
import { AccountActivationApplication } from '../application/account-activation.application.js';
import { PostgresAccountAdapter } from '../adapters/postgres-account.adapter.js';
import { RedisIdempotencyAdapter } from '../adapters/redis-idempotency.adapter.js';
import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { FineractAdapterStub } from '../adapters/fineract.adapter.js';
import { createApp } from '../app.js';
import { buildAccount } from '../domain/account.js';
import { AccountEventsPublisher } from '../events/account.events.js';
import { AuditEventsService } from '../events/audit.events.js';
import { AccountActivationMetrics } from '../events/metrics.js';

function buildHarness() {
  const postgresAdapter = new PostgresAccountAdapter();
  const redisAdapter = new RedisIdempotencyAdapter();
  const kafkaProducer = new KafkaProducerAdapter();
  const accountEvents = new AccountEventsPublisher(kafkaProducer);
  const auditEvents = new AuditEventsService();
  const metrics = new AccountActivationMetrics();

  const application = new AccountActivationApplication(
    postgresAdapter,
    redisAdapter,
    accountEvents,
    auditEvents,
    metrics,
    {
      info: (payload: Record<string, unknown>, message: string): void => {
        void payload;
        void message;
      },
      warn: (payload: Record<string, unknown>, message: string): void => {
        void payload;
        void message;
      },
      error: (payload: Record<string, unknown>, message: string): void => {
        void payload;
        void message;
      }
    }
  );

  return { postgresAdapter, redisAdapter, kafkaProducer, accountEvents, auditEvents, metrics, application };
}

function buildAccountCreatedEvent(input: { eventId: string; accountId: string; customerId: string }) {
  return {
    specVersion: '1.0',
    type: 'account.created.v1',
    version: 1,
    metadata: {
      eventId: input.eventId,
      correlationId: 'corr-account-activation',
      timestamp: new Date().toISOString(),
      producer: 'account-service'
    },
    payload: {
      accountId: input.accountId,
      customerId: input.customerId,
      status: 'PENDING_ACTIVATION'
    }
  };
}

test('account.created.v1 activates PENDING_ACTIVATION account and emits account.activated.v1', async () => {
  const harness = buildHarness();
  const account = buildAccount({
    accountId: 'acc-activation-1',
    customerId: 'cust-activation-1',
    productCode: 'SAVINGS',
    currency: 'USD',
    status: 'PENDING_ACTIVATION',
    createdAt: new Date().toISOString(),
    externalAccountId: 'internal-cust-activation-1',
    openingBalanceCents: 0
  });
  await harness.postgresAdapter.createAccount(account);

  const result = await harness.application.processAccountCreated(buildAccountCreatedEvent({
    eventId: 'evt-account-created-activation-1',
    accountId: account.accountId,
    customerId: account.customerId
  }));

  assert.equal(result.kind, 'activated');
  const stored = await harness.postgresAdapter.getAccountById(account.accountId);
  assert.equal(stored?.status, 'ACTIVE');
  assert.ok(harness.kafkaProducer.events.some((event) => event.type === 'account.activated.v1'));
});

test('duplicate activation event does not activate twice', async () => {
  const harness = buildHarness();
  const account = buildAccount({
    accountId: 'acc-activation-dup',
    customerId: 'cust-activation-dup',
    productCode: 'SAVINGS',
    currency: 'USD',
    status: 'PENDING_ACTIVATION',
    createdAt: new Date().toISOString(),
    externalAccountId: 'internal-cust-activation-dup',
    openingBalanceCents: 0
  });
  await harness.postgresAdapter.createAccount(account);

  const event = buildAccountCreatedEvent({
    eventId: 'evt-account-created-dup',
    accountId: account.accountId,
    customerId: account.customerId
  });
  const first = await harness.application.processAccountCreated(event);
  assert.equal(first.kind, 'activated');

  const second = await harness.application.processAccountCreated(event);
  assert.equal(second.kind, 'duplicate_event');
  assert.equal(harness.kafkaProducer.events.filter((item) => item.type === 'account.activated.v1').length, 1);
});

test('already ACTIVE account is skipped safely', async () => {
  const harness = buildHarness();
  const account = buildAccount({
    accountId: 'acc-activation-active',
    customerId: 'cust-activation-active',
    productCode: 'SAVINGS',
    currency: 'USD',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    externalAccountId: 'internal-cust-activation-active',
    openingBalanceCents: 0
  });
  await harness.postgresAdapter.createAccount(account);

  const result = await harness.application.processAccountCreated(buildAccountCreatedEvent({
    eventId: 'evt-account-created-active',
    accountId: account.accountId,
    customerId: account.customerId
  }));

  assert.equal(result.kind, 'already_active');
  assert.equal(harness.kafkaProducer.events.filter((item) => item.type === 'account.activated.v1').length, 0);
});

test('invalid transition is blocked safely', async () => {
  const harness = buildHarness();
  const account = buildAccount({
    accountId: 'acc-activation-suspended',
    customerId: 'cust-activation-suspended',
    productCode: 'SAVINGS',
    currency: 'USD',
    status: 'SUSPENDED',
    createdAt: new Date().toISOString(),
    externalAccountId: 'internal-cust-activation-suspended',
    openingBalanceCents: 0
  });
  await harness.postgresAdapter.createAccount(account);

  const result = await harness.application.processAccountCreated(buildAccountCreatedEvent({
    eventId: 'evt-account-created-suspended',
    accountId: account.accountId,
    customerId: account.customerId
  }));

  assert.equal(result.kind, 'invalid_transition');
  assert.equal(harness.kafkaProducer.events.filter((item) => item.type === 'account.activated.v1').length, 0);
});

test('malformed event is handled safely', async () => {
  const harness = buildHarness();
  const result = await harness.application.processAccountCreated({
    specVersion: '1.0',
    type: 'account.created.v1',
    version: 1,
    metadata: {
      eventId: 'evt-account-bad',
      correlationId: 'corr-bad',
      timestamp: new Date().toISOString(),
      producer: 'account-service'
    },
    payload: {
      customerId: 'cust-bad'
    }
  });

  assert.equal(result.kind, 'invalid_event');
});

test('manual activation endpoint activates valid account', async () => {
  const postgresAdapter = new PostgresAccountAdapter();
  const redisAdapter = new RedisIdempotencyAdapter();
  const fineractAdapter = new FineractAdapterStub();
  const kafkaProducer = new KafkaProducerAdapter();
  const accountEvents = new AccountEventsPublisher(kafkaProducer);
  const auditEvents = new AuditEventsService();
  const accountApplication = buildAccountApplication({
    postgresAdapter,
    redisAdapter,
    fineractAdapter,
    kafkaProducer,
    accountEventsPublisher: accountEvents,
    auditEventsService: auditEvents
  });
  const activationApplication = new AccountActivationApplication(
    postgresAdapter,
    redisAdapter,
    accountEvents,
    auditEvents,
    new AccountActivationMetrics(),
    {
      info: (payload: Record<string, unknown>, message: string): void => {
        void payload;
        void message;
      },
      warn: (payload: Record<string, unknown>, message: string): void => {
        void payload;
        void message;
      },
      error: (payload: Record<string, unknown>, message: string): void => {
        void payload;
        void message;
      }
    }
  );
  const app = createApp({
    accountApplication,
    accountActivationApplication: activationApplication
  });

  const created = await app.inject({
    method: 'POST',
    url: '/accounts',
    headers: {
      'x-idempotency-key': 'idem-manual-activation-create'
    },
    payload: {
      customerId: 'cust-manual-activation',
      productCode: 'SV',
      currency: 'USD',
      initialDepositCents: 1000
    }
  });
  const createdPayload = created.json() as { data: { accountId: string; status: string } };
  assert.equal(createdPayload.data.status, 'PENDING_ACTIVATION');

  const response = await app.inject({
    method: 'POST',
    url: `/accounts/${createdPayload.data.accountId}/activate`,
    headers: {
      'x-idempotency-key': 'idem-manual-activation-route',
      'x-internal-ops-role': 'ops',
      'x-internal-ops-actor-id': 'ops-activation-user',
      'x-correlation-id': 'corr-manual-activation-route'
    },
    payload: {
      reason: 'manual go-live check passed'
    }
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { success: boolean; data: { status: string } };
  assert.equal(payload.success, true);
  assert.equal(payload.data.status, 'ACTIVE');
  assert.ok(kafkaProducer.events.some((event) => event.type === 'account.activated.v1'));

  await app.close();
});

test('manual activation endpoint blocks invalid transition safely', async () => {
  const postgresAdapter = new PostgresAccountAdapter();
  const redisAdapter = new RedisIdempotencyAdapter();
  const fineractAdapter = new FineractAdapterStub();
  const kafkaProducer = new KafkaProducerAdapter();
  const accountEvents = new AccountEventsPublisher(kafkaProducer);
  const auditEvents = new AuditEventsService();
  const accountApplication = buildAccountApplication({
    postgresAdapter,
    redisAdapter,
    fineractAdapter,
    kafkaProducer,
    accountEventsPublisher: accountEvents,
    auditEventsService: auditEvents
  });
  const activationApplication = new AccountActivationApplication(
    postgresAdapter,
    redisAdapter,
    accountEvents,
    auditEvents,
    new AccountActivationMetrics(),
    {
      info: (payload: Record<string, unknown>, message: string): void => {
        void payload;
        void message;
      },
      warn: (payload: Record<string, unknown>, message: string): void => {
        void payload;
        void message;
      },
      error: (payload: Record<string, unknown>, message: string): void => {
        void payload;
        void message;
      }
    }
  );

  const suspended = buildAccount({
    accountId: 'acc-manual-suspended-1',
    customerId: 'cust-manual-suspended-1',
    productCode: 'SV',
    currency: 'USD',
    status: 'SUSPENDED',
    createdAt: new Date().toISOString(),
    externalAccountId: 'internal-cust-manual-suspended-1',
    openingBalanceCents: 0
  });
  await postgresAdapter.createAccount(suspended);

  const app = createApp({
    accountApplication,
    accountActivationApplication: activationApplication
  });
  const response = await app.inject({
    method: 'POST',
    url: `/accounts/${suspended.accountId}/activate`,
    headers: {
      'x-idempotency-key': 'idem-manual-invalid-transition',
      'x-internal-ops-role': 'ops',
      'x-internal-ops-actor-id': 'ops-activation-user',
      'x-correlation-id': 'corr-manual-invalid-transition'
    },
    payload: {
      reason: 'attempt invalid transition'
    }
  });

  assert.equal(response.statusCode, 409);
  const payload = response.json() as { success: boolean; error: { code: string } };
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'conflict');
  assert.equal(kafkaProducer.events.filter((item) => item.type === 'account.activated.v1').length, 0);

  await app.close();
});
