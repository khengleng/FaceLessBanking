import assert from 'node:assert/strict';
import test from 'node:test';

import { KafkaAmlAdapter } from '../adapters/kafka-aml.adapter.js';
import { PostgresAmlAdapter } from '../adapters/postgres-aml.adapter.js';
import { createApp } from '../app.js';
import { AMLMetrics } from '../events/metrics.js';

function buildHarness() {
  const postgresAdapter = new PostgresAmlAdapter();
  const kafkaAdapter = new KafkaAmlAdapter();
  const metrics = new AMLMetrics();

  const app = createApp({
    postgresAdapter,
    kafkaAdapter,
    metrics
  });

  return {
    app,
    postgresAdapter,
    kafkaAdapter,
    metrics
  };
}

function buildPaymentInitiatedEvent(input: {
  eventId: string;
  correlationId: string;
  paymentId: string;
  sourceAccountId: string;
  customerId?: string;
  amount: number;
  currency: string;
  countryCode?: string;
}) {
  return {
    specVersion: '1.0',
    type: 'payment.initiated.v1',
    version: 1,
    metadata: {
      eventId: input.eventId,
      correlationId: input.correlationId,
      timestamp: new Date().toISOString(),
      producer: 'payment-orchestration'
    },
    payload: {
      paymentId: input.paymentId,
      sourceAccountId: input.sourceAccountId,
      customerId: input.customerId,
      amount: input.amount,
      currency: input.currency,
      countryCode: input.countryCode
    }
  };
}

function buildPaymentStatusUpdatedEvent(input: {
  eventId: string;
  correlationId: string;
  paymentId: string;
  sourceAccountId: string;
  amount: number;
  currency: string;
  status: string;
}) {
  return {
    specVersion: '1.0',
    type: 'payment.status.updated.v1',
    version: 1,
    metadata: {
      eventId: input.eventId,
      correlationId: input.correlationId,
      timestamp: new Date().toISOString(),
      producer: 'payment-orchestration'
    },
    payload: {
      paymentId: input.paymentId,
      sourceAccountId: input.sourceAccountId,
      amount: input.amount,
      currency: input.currency,
      status: input.status
    }
  };
}

test('suspicious transaction flagged', async () => {
  const { app, kafkaAdapter } = buildHarness();

  await kafkaAdapter.handlePaymentEvent(
    buildPaymentInitiatedEvent({
      eventId: 'evt-suspicious-1',
      correlationId: 'corr-suspicious-1',
      paymentId: 'pay-suspicious-1',
      sourceAccountId: 'acc-001',
      amount: 20000,
      currency: 'USD'
    })
  );

  const list = await app.inject({ method: 'GET', url: '/aml/alerts' });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().data.items.length, 1);
  assert.equal(list.json().data.items[0].ruleName, 'LARGE_TRANSACTION_THRESHOLD');
  assert.equal(kafkaAdapter.publishedEvents.length, 1);
  assert.equal(kafkaAdapter.publishedEvents[0]?.type, 'aml.alert.v1');

  await app.close();
});

test('normal transaction ignored', async () => {
  const { app, kafkaAdapter } = buildHarness();

  await kafkaAdapter.handlePaymentEvent(
    buildPaymentInitiatedEvent({
      eventId: 'evt-normal-1',
      correlationId: 'corr-normal-1',
      paymentId: 'pay-normal-1',
      sourceAccountId: 'acc-002',
      amount: 100,
      currency: 'USD'
    })
  );

  const list = await app.inject({ method: 'GET', url: '/aml/alerts' });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().data.items.length, 0);
  assert.equal(kafkaAdapter.publishedEvents.length, 0);

  await app.close();
});

test('duplicate event skipped', async () => {
  const { app, kafkaAdapter, metrics } = buildHarness();

  const event = buildPaymentInitiatedEvent({
    eventId: 'evt-dup-1',
    correlationId: 'corr-dup-1',
    paymentId: 'pay-dup-1',
    sourceAccountId: 'acc-003',
    amount: 25000,
    currency: 'USD'
  });

  await kafkaAdapter.handlePaymentEvent(event);
  await kafkaAdapter.handlePaymentEvent(event);

  const list = await app.inject({ method: 'GET', url: '/aml/alerts' });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().data.items.length, 1);
  assert.equal(metrics.duplicateAmlEventsSkipped, 1);

  await app.close();
});

test('malformed event handled safely', async () => {
  const { app, kafkaAdapter, metrics } = buildHarness();

  await kafkaAdapter.handlePaymentEvent({
    specVersion: '1.0',
    type: 'payment.initiated.v1',
    version: 1,
    metadata: {
      eventId: 'evt-bad-1',
      correlationId: 'corr-bad-1',
      timestamp: new Date().toISOString(),
      producer: 'payment-orchestration'
    },
    payload: {
      paymentId: 'pay-bad-1'
    }
  });

  const list = await app.inject({ method: 'GET', url: '/aml/alerts' });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().data.items.length, 0);
  assert.equal(metrics.malformedAmlEventsRejected, 1);

  await app.close();
});

test('alert query endpoints work', async () => {
  const { app, kafkaAdapter } = buildHarness();

  await kafkaAdapter.handlePaymentEvent(
    buildPaymentStatusUpdatedEvent({
      eventId: 'evt-query-1',
      correlationId: 'corr-query-1',
      paymentId: 'pay-query-1',
      sourceAccountId: 'acc-004',
      amount: 15000,
      currency: 'USD',
      status: 'COMPLETED'
    })
  );

  const list = await app.inject({ method: 'GET', url: '/aml/alerts' });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().data.items.length, 1);

  const alertId = list.json().data.items[0].alertId as string;
  const byId = await app.inject({ method: 'GET', url: `/aml/alerts/${alertId}` });

  assert.equal(byId.statusCode, 200);
  assert.equal(byId.json().data.alertId, alertId);
  assert.equal(byId.json().data.entityType, 'PAYMENT');

  await app.close();
});
