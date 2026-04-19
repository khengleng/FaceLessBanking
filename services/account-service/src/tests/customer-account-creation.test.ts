import assert from 'node:assert/strict';
import test from 'node:test';

import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresAccountAdapter } from '../adapters/postgres-account.adapter.js';
import { CustomerAccountCreationApplication } from '../application/customer-account-creation.application.js';
import { AccountEventsPublisher } from '../events/account.events.js';
import { AuditEventsService } from '../events/audit.events.js';
import { CustomerAccountCreationMetrics } from '../events/metrics.js';

function buildHarness() {
  const postgresAdapter = new PostgresAccountAdapter();
  const kafkaProducer = new KafkaProducerAdapter();
  const accountEvents = new AccountEventsPublisher(kafkaProducer);
  const auditEvents = new AuditEventsService();
  const metrics = new CustomerAccountCreationMetrics();

  const application = new CustomerAccountCreationApplication(
    postgresAdapter,
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

  return {
    application,
    postgresAdapter,
    kafkaProducer,
    auditEvents,
    metrics
  };
}

function buildCustomerCreatedEvent(input: {
  eventId: string;
  customerId: string;
  onboardingReference?: string;
}) {
  return {
    specVersion: '1.0',
    type: 'customer.created.v1',
    version: 1,
    metadata: {
      eventId: input.eventId,
      correlationId: 'corr-account-from-customer',
      timestamp: new Date().toISOString(),
      producer: 'customer-service'
    },
    payload: {
      customerId: input.customerId,
      onboardingReference: input.onboardingReference,
      sourceEventId: 'source-event-1',
      status: 'ACTIVE'
    }
  };
}

test('customer.created.v1 creates account and emits account.created.v1', async () => {
  const harness = buildHarness();

  const result = await harness.application.processCustomerCreated(buildCustomerCreatedEvent({
    eventId: 'evt-customer-created-1',
    customerId: 'cust-evt-1',
    onboardingReference: 'onboarding-1'
  }));

  assert.equal(result.kind, 'created');
  if (result.kind !== 'created') {
    return;
  }

  assert.equal(result.account.customerId, 'cust-evt-1');
  assert.equal(result.account.accountType, 'SAVINGS');
  assert.equal(result.account.status, 'PENDING_ACTIVATION');

  const accountCreated = harness.kafkaProducer.events.find((event) => event.type === 'account.created.v1');
  assert.ok(accountCreated);
  assert.equal(accountCreated?.payload.customerId, 'cust-evt-1');
  assert.equal(accountCreated?.payload.accountType, 'SAVINGS');
  assert.equal(accountCreated?.payload.sourceEventId, 'evt-customer-created-1');
  assert.equal(harness.metrics.accountsCreatedFromCustomerEvents, 1);
});

test('duplicate source event does not create duplicate account', async () => {
  const harness = buildHarness();
  const event = buildCustomerCreatedEvent({
    eventId: 'evt-customer-dup-1',
    customerId: 'cust-dup-1'
  });

  const first = await harness.application.processCustomerCreated(event);
  assert.equal(first.kind, 'created');

  const second = await harness.application.processCustomerCreated(event);
  assert.equal(second.kind, 'duplicate_event');
  assert.equal(harness.metrics.duplicateAccountCreationEventsSkipped, 1);

  const createEvents = harness.kafkaProducer.events.filter((item) => item.type === 'account.created.v1');
  assert.equal(createEvents.length, 1);
});

test('existing account for customerId is handled safely', async () => {
  const harness = buildHarness();

  const first = await harness.application.processCustomerCreated(buildCustomerCreatedEvent({
    eventId: 'evt-customer-existing-1',
    customerId: 'cust-existing-1'
  }));
  assert.equal(first.kind, 'created');

  const second = await harness.application.processCustomerCreated(buildCustomerCreatedEvent({
    eventId: 'evt-customer-existing-2',
    customerId: 'cust-existing-1'
  }));
  assert.equal(second.kind, 'already_exists');
  assert.equal(harness.metrics.existingAccountSkips, 1);
});

test('malformed event is handled safely', async () => {
  const harness = buildHarness();

  const result = await harness.application.processCustomerCreated({
    specVersion: '1.0',
    type: 'customer.created.v1',
    version: 1,
    metadata: {
      eventId: 'evt-bad-1',
      correlationId: 'corr-bad',
      timestamp: new Date().toISOString(),
      producer: 'customer-service'
    },
    payload: {
      status: 'ACTIVE'
    }
  });

  assert.equal(result.kind, 'invalid_event');
});
