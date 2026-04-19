import assert from 'node:assert/strict';
import test from 'node:test';

import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresLoanAdapter } from '../adapters/postgres-loan.adapter.js';
import { LoanScheduleApplication } from '../application/loan-schedule.application.js';
import { LoanEventsPublisher } from '../events/loan.events.js';
import { LoanScheduleMetrics } from '../events/metrics.js';

function createHarness() {
  const postgresAdapter = new PostgresLoanAdapter();
  const kafkaProducer = new KafkaProducerAdapter();
  const loanEvents = new LoanEventsPublisher(kafkaProducer);
  const metrics = new LoanScheduleMetrics();

  const application = new LoanScheduleApplication(
    postgresAdapter,
    loanEvents,
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
    },
    1200
  );

  return {
    application,
    postgresAdapter,
    kafkaProducer,
    metrics
  };
}

test('loan account input generates schedule entries', async () => {
  const harness = createHarness();

  await harness.postgresAdapter.insertLoan({
    loanId: 'loan-schedule-1',
    customerId: 'cust-1',
    productCode: 'PL',
    principalCents: 120000,
    currency: 'USD',
    termMonths: 12,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    externalLoanId: 'loan-ext-1'
  });

  const result = await harness.application.generateForLoanAccount('loan-schedule-1', 'corr-schedule-1');

  assert.equal(result.kind, 'generated');
  if (result.kind !== 'generated') {
    return;
  }

  assert.equal(result.entries.length, 12);
  const persisted = await harness.postgresAdapter.getRepaymentScheduleByLoanAccountId('loan-schedule-1');
  assert.ok(persisted);
  assert.equal(persisted?.scheduleId, result.schedule.scheduleId);
});

test('duplicate trigger does not generate duplicate schedule', async () => {
  const harness = createHarness();

  await harness.postgresAdapter.insertLoan({
    loanId: 'loan-schedule-2',
    customerId: 'cust-2',
    productCode: 'PL',
    principalCents: 60000,
    currency: 'USD',
    termMonths: 6,
    status: 'ACTIVE',
    createdAt: '2026-01-15T00:00:00.000Z',
    externalLoanId: 'loan-ext-2'
  });

  const event = {
    specVersion: '1.0',
    type: 'loan.account.created.v1',
    version: 1,
    metadata: {
      eventId: 'evt-schedule-dup-1',
      correlationId: 'corr-schedule-dup-1',
      timestamp: new Date().toISOString(),
      producer: 'loan-orchestration'
    },
    payload: {
      loanAccountId: 'loan-schedule-2'
    }
  };

  const first = await harness.application.processLoanAccountCreated(event);
  assert.equal(first.kind, 'generated');

  const second = await harness.application.processLoanAccountCreated(event);
  assert.equal(second.kind, 'duplicate_event');
  assert.equal(harness.metrics.duplicateScheduleGenerationsSkipped, 1);
});

test('schedule totals are consistent under placeholder formula', async () => {
  const harness = createHarness();

  await harness.postgresAdapter.insertLoan({
    loanId: 'loan-schedule-3',
    customerId: 'cust-3',
    productCode: 'PL',
    principalCents: 100000,
    currency: 'USD',
    termMonths: 10,
    status: 'ACTIVE',
    createdAt: '2026-02-01T00:00:00.000Z',
    externalLoanId: 'loan-ext-3'
  });

  const result = await harness.application.generateForLoanAccount('loan-schedule-3', 'corr-schedule-3');
  assert.equal(result.kind, 'generated');
  if (result.kind !== 'generated') {
    return;
  }

  const totalPrincipal = result.entries.reduce((sum, entry) => sum + entry.principalDue, 0);
  assert.equal(totalPrincipal, 100000);
  assert.equal(result.entries[result.entries.length - 1]?.outstandingPrincipalAfter, 0);
});

test('malformed input fails safely', async () => {
  const harness = createHarness();

  await harness.postgresAdapter.insertLoan({
    loanId: 'loan-schedule-4',
    customerId: 'cust-4',
    productCode: 'PL',
    principalCents: 100000,
    currency: 'USD',
    termMonths: 0,
    status: 'ACTIVE',
    createdAt: '2026-02-10T00:00:00.000Z',
    externalLoanId: 'loan-ext-4'
  });

  const result = await harness.application.generateForLoanAccount('loan-schedule-4', 'corr-schedule-4');
  assert.equal(result.kind, 'invalid_loan');
  assert.equal(harness.metrics.scheduleGenerationFailures, 1);
});

test('generated event is emitted', async () => {
  const harness = createHarness();

  await harness.postgresAdapter.insertLoan({
    loanId: 'loan-schedule-5',
    customerId: 'cust-5',
    productCode: 'PL',
    principalCents: 70000,
    currency: 'USD',
    termMonths: 7,
    status: 'ACTIVE',
    createdAt: '2026-03-01T00:00:00.000Z',
    externalLoanId: 'loan-ext-5'
  });

  const result = await harness.application.generateForLoanAccount('loan-schedule-5', 'corr-schedule-5');
  assert.equal(result.kind, 'generated');

  const event = harness.kafkaProducer.events.find((item) => item.type === 'loan.schedule.generated.v1');
  assert.ok(event);
  assert.equal(event?.metadata.correlationId, 'corr-schedule-5');
  assert.equal(event?.payload.loanAccountId, 'loan-schedule-5');
  assert.equal(event?.payload.numberOfInstallments, 7);
});

test('schedule entry ordering is correct', async () => {
  const harness = createHarness();

  await harness.postgresAdapter.insertLoan({
    loanId: 'loan-schedule-6',
    customerId: 'cust-6',
    productCode: 'PL',
    principalCents: 90000,
    currency: 'USD',
    termMonths: 9,
    status: 'ACTIVE',
    createdAt: '2026-04-01T00:00:00.000Z',
    externalLoanId: 'loan-ext-6'
  });

  const result = await harness.application.generateForLoanAccount('loan-schedule-6', 'corr-schedule-6');
  assert.equal(result.kind, 'generated');
  if (result.kind !== 'generated') {
    return;
  }

  const entries = result.entries;
  for (let i = 0; i < entries.length; i += 1) {
    const expectedInstallmentNumber = i + 1;
    assert.equal(entries[i]?.installmentNumber, expectedInstallmentNumber);

    if (i > 0) {
      const previousDueDate = new Date(entries[i - 1]?.dueDate ?? '').getTime();
      const currentDueDate = new Date(entries[i]?.dueDate ?? '').getTime();
      assert.equal(currentDueDate > previousDueDate, true);
    }
  }
});
