import assert from 'node:assert/strict';
import test from 'node:test';

import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresCustomerAdapter, type PostgresClient } from '../adapters/postgres-customer.adapter.js';
import { OnboardingCustomerCreationApplication } from '../application/onboarding-customer-creation.application.js';
import type { Customer } from '../domain/customer.js';
import { AuditEventsService } from '../events/audit.events.js';
import { CustomerEventsPublisher } from '../events/customer.events.js';
import { OnboardingCustomerCreationMetrics } from '../events/metrics.js';

function buildHarness(): {
  application: OnboardingCustomerCreationApplication;
  kafkaProducer: KafkaProducerAdapter;
  metrics: OnboardingCustomerCreationMetrics;
  state: {
    customersByOnboardingReference: Map<string, Customer>;
    processedEventIds: Set<string>;
  };
} {
  const state = {
    customersByOnboardingReference: new Map<string, Customer>(),
    processedEventIds: new Set<string>()
  };

  const db: PostgresClient = {
    query: async (text: string, params: unknown[] = []) => {
      if (text.includes('SELECT 1 FROM processed_customer_creation_events')) {
        const eventId = String(params[0]);
        if (state.processedEventIds.has(eventId)) {
          return { rowCount: 1, rows: [{ ok: 1 }] };
        }
        return { rowCount: 0, rows: [] };
      }

      if (text.includes('INSERT INTO processed_customer_creation_events')) {
        state.processedEventIds.add(String(params[0]));
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('SELECT * FROM customers WHERE onboarding_reference = $1')) {
        const ref = String(params[0]);
        const customer = state.customersByOnboardingReference.get(ref);
        if (!customer) {
          return { rowCount: 0, rows: [] };
        }

        return {
          rowCount: 1,
          rows: [{
            customer_id: customer.customerId,
            first_name: customer.firstName,
            last_name: customer.lastName,
            email: customer.email,
            phone_number: customer.phoneNumber,
            date_of_birth: customer.dateOfBirth,
            onboarding_reference: customer.onboardingReference,
            source_entity_id: customer.sourceEntityId,
            provider_reference: customer.providerReference,
            status: customer.status,
            created_at: customer.createdAt,
            updated_at: customer.updatedAt ?? customer.createdAt
          }]
        };
      }

      if (text.includes('INSERT INTO customers')) {
        const customer: Customer = {
          customerId: String(params[0]),
          firstName: String(params[1]),
          lastName: String(params[2]),
          email: String(params[3]),
          phoneNumber: typeof params[4] === 'string' ? params[4] : undefined,
          dateOfBirth: typeof params[5] === 'string' ? params[5] : undefined,
          onboardingReference: typeof params[6] === 'string' ? params[6] : undefined,
          sourceEntityId: typeof params[7] === 'string' ? params[7] : undefined,
          providerReference: typeof params[8] === 'string' ? params[8] : undefined,
          status: String(params[9]) as Customer['status'],
          createdAt: String(params[10]),
          updatedAt: String(params[11])
        };

        if (customer.onboardingReference) {
          state.customersByOnboardingReference.set(customer.onboardingReference, customer);
        }

        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    }
  };

  const postgresAdapter = new PostgresCustomerAdapter(db);
  const kafkaProducer = new KafkaProducerAdapter();
  const customerEvents = new CustomerEventsPublisher(kafkaProducer);
  const auditEvents = new AuditEventsService(kafkaProducer);
  const metrics = new OnboardingCustomerCreationMetrics();

  const application = new OnboardingCustomerCreationApplication(
    postgresAdapter,
    customerEvents,
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

  return { application, kafkaProducer, metrics, state };
}

function buildEkycEvent(input: {
  eventId: string;
  status: string;
  sessionId?: string;
  customerId?: string;
}) {
  return {
    specVersion: '1.0',
    type: 'ekyc.status.updated.v1',
    version: 1,
    metadata: {
      eventId: input.eventId,
      correlationId: 'corr-onboarding-customer',
      timestamp: new Date().toISOString(),
      producer: 'ekyc-orchestration'
    },
    payload: {
      sessionId: input.sessionId ?? 'ekyc-session-1',
      customerId: input.customerId,
      status: input.status,
      newStatus: input.status,
      provider: 'SUMSUB'
    }
  };
}

function buildCaseActionEvent(input: {
  eventId: string;
  newStatus: string;
  caseId?: string;
  caseType?: string;
  entityId?: string;
}) {
  return {
    specVersion: '1.0',
    type: 'case.action.recorded.v1',
    version: 1,
    metadata: {
      eventId: input.eventId,
      correlationId: 'corr-onboarding-customer-case',
      timestamp: new Date().toISOString(),
      producer: 'workflow-case-management'
    },
    payload: {
      caseId: input.caseId ?? 'onboarding-case-1',
      actionId: 'action-1',
      caseType: input.caseType ?? 'ONBOARDING_REVIEW',
      entityId: input.entityId,
      newStatus: input.newStatus
    }
  };
}

test('approved onboarding event creates customer and emits customer.created.v1', async () => {
  const harness = buildHarness();

  const result = await harness.application.processEkycStatusUpdated(buildEkycEvent({
    eventId: 'evt-ekyc-approved-1',
    status: 'APPROVED',
    sessionId: 'session-approved-1'
  }));

  assert.equal(result.kind, 'created');
  assert.equal(harness.metrics.customersCreatedFromOnboarding, 1);

  const customerEvent = harness.kafkaProducer.events.find((event) => event.type === 'customer.created.v1');
  assert.ok(customerEvent);
});

test('approved onboarding case action event creates customer and emits customer.created.v1', async () => {
  const harness = buildHarness();

  const result = await harness.application.processCaseActionRecorded(buildCaseActionEvent({
    eventId: 'evt-case-approved-1',
    newStatus: 'APPROVED',
    caseId: 'onboarding-case-11'
  }));

  assert.equal(result.kind, 'created');
  assert.equal(harness.metrics.customersCreatedFromOnboarding, 1);

  const customerEvent = harness.kafkaProducer.events.find((event) => event.type === 'customer.created.v1');
  assert.ok(customerEvent);
});

test('non-approved onboarding event does not create customer', async () => {
  const harness = buildHarness();

  const result = await harness.application.processEkycStatusUpdated(buildEkycEvent({
    eventId: 'evt-ekyc-pending-1',
    status: 'PENDING_REVIEW'
  }));

  assert.equal(result.kind, 'ignored_status');
  assert.equal(harness.kafkaProducer.events.find((event) => event.type === 'customer.created.v1'), undefined);
});

test('duplicate source event does not create duplicate customer', async () => {
  const harness = buildHarness();
  const event = buildEkycEvent({
    eventId: 'evt-ekyc-dup-1',
    status: 'APPROVED',
    sessionId: 'session-dup-1'
  });

  const first = await harness.application.processEkycStatusUpdated(event);
  assert.equal(first.kind, 'created');

  const second = await harness.application.processEkycStatusUpdated(event);
  assert.equal(second.kind, 'duplicate_event');
  assert.equal(harness.metrics.duplicateCustomerCreationEventsSkipped, 1);

  const createEvents = harness.kafkaProducer.events.filter((item) => item.type === 'customer.created.v1');
  assert.equal(createEvents.length, 1);
});

test('existing customer for onboarding reference is handled safely', async () => {
  const harness = buildHarness();
  const existing = {
    customerId: 'existing-customer-1',
    firstName: 'Onboarding',
    lastName: 'Customer',
    email: 'onboarding+existing-ref@placeholder.local',
    status: 'ACTIVE' as const,
    createdAt: new Date().toISOString(),
    onboardingReference: 'existing-ref'
  };
  harness.state.customersByOnboardingReference.set('existing-ref', existing);

  const result = await harness.application.processEkycStatusUpdated(buildEkycEvent({
    eventId: 'evt-ekyc-existing-1',
    status: 'APPROVED',
    sessionId: 'existing-ref'
  }));

  assert.equal(result.kind, 'already_exists');
  assert.equal(harness.metrics.approvalsIgnoredCustomerAlreadyExists, 1);
});

test('malformed event is handled safely', async () => {
  const harness = buildHarness();
  const result = await harness.application.processEkycStatusUpdated({
    specVersion: '1.0',
    type: 'ekyc.status.updated.v1',
    version: 1,
    metadata: {
      eventId: 'evt-bad-1',
      correlationId: 'corr-bad',
      timestamp: new Date().toISOString(),
      producer: 'ekyc-orchestration'
    },
    payload: {
      status: 'APPROVED'
    }
  });

  assert.equal(result.kind, 'invalid_event');
});
