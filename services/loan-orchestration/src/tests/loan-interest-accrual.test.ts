import assert from 'node:assert/strict';
import test from 'node:test';

import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresLoanAdapter } from '../adapters/postgres-loan.adapter.js';
import { LoanInterestAccrualApplication } from '../application/loan-interest-accrual.application.js';
import { buildLoan } from '../domain/loan.js';
import { LoanEventsPublisher } from '../events/loan.events.js';
import { LoanInterestAccrualMetrics } from '../events/metrics.js';

function createHarness() {
  const postgresAdapter = new PostgresLoanAdapter();
  const kafkaProducer = new KafkaProducerAdapter();
  const loanEvents = new LoanEventsPublisher(kafkaProducer);
  const metrics = new LoanInterestAccrualMetrics();

  const application = new LoanInterestAccrualApplication(
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
    1200,
    365
  );

  return {
    application,
    postgresAdapter,
    kafkaProducer,
    metrics
  };
}

test('daily accrual creates correct accrual record', async () => {
  const harness = createHarness();

  await harness.postgresAdapter.insertLoan(buildLoan({
    loanId: 'loan-accrual-daily-1',
    customerId: 'cust-1',
    productCode: 'PL',
    principalCents: 365000,
    annualInterestRateBps: 1000,
    currency: 'USD',
    termMonths: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
    externalLoanId: 'loan-ext-1'
  }));
  await harness.postgresAdapter.updateLoanAccountStatus('loan-accrual-daily-1', 'ACTIVE');

  const result = await harness.application.runAccrualForMode({
    accrualMode: 'DAILY',
    accrualDate: '2026-01-15',
    correlationId: 'corr-accrual-daily-1'
  });

  assert.equal(result.processed, 1);

  const accruals = harness.postgresAdapter.getInterestAccrualsForLoanForTests('loan-accrual-daily-1');
  assert.equal(accruals.length, 1);
  assert.equal(accruals[0]?.accrualMode, 'DAILY');
  assert.equal(accruals[0]?.accrualDate, '2026-01-15');
  assert.equal(accruals[0]?.accruedInterest, 100);
});

test('monthly accrual creates correct accrual record', async () => {
  const harness = createHarness();

  await harness.postgresAdapter.insertLoan(buildLoan({
    loanId: 'loan-accrual-monthly-1',
    customerId: 'cust-2',
    productCode: 'PL',
    principalCents: 120000,
    annualInterestRateBps: 1200,
    currency: 'USD',
    termMonths: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
    externalLoanId: 'loan-ext-2'
  }));
  await harness.postgresAdapter.updateLoanAccountStatus('loan-accrual-monthly-1', 'ACTIVE');

  const result = await harness.application.runAccrualForMode({
    accrualMode: 'MONTHLY',
    accrualDate: '2026-01-31',
    correlationId: 'corr-accrual-monthly-1'
  });

  assert.equal(result.processed, 1);

  const accruals = harness.postgresAdapter.getInterestAccrualsForLoanForTests('loan-accrual-monthly-1');
  assert.equal(accruals.length, 1);
  assert.equal(accruals[0]?.accrualMode, 'MONTHLY');
  assert.equal(accruals[0]?.accruedInterest, 1200);
});

test('duplicate accrual is skipped safely', async () => {
  const harness = createHarness();

  await harness.postgresAdapter.insertLoan(buildLoan({
    loanId: 'loan-accrual-dup-1',
    customerId: 'cust-3',
    productCode: 'PL',
    principalCents: 50000,
    annualInterestRateBps: 1000,
    currency: 'USD',
    termMonths: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
    externalLoanId: 'loan-ext-3'
  }));
  await harness.postgresAdapter.updateLoanAccountStatus('loan-accrual-dup-1', 'ACTIVE');

  const first = await harness.application.runAccrualForMode({
    accrualMode: 'DAILY',
    accrualDate: '2026-02-10'
  });
  assert.equal(first.processed, 1);

  const second = await harness.application.runAccrualForMode({
    accrualMode: 'DAILY',
    accrualDate: '2026-02-10'
  });

  assert.equal(second.processed, 0);
  assert.equal(second.duplicatesSkipped, 1);
  assert.equal(harness.metrics.duplicateAccrualsSkipped, 1);
  assert.equal(harness.postgresAdapter.getInterestAccrualsForLoanForTests('loan-accrual-dup-1').length, 1);
});

test('inactive or closed loan is skipped', async () => {
  const harness = createHarness();

  await harness.postgresAdapter.insertLoan(buildLoan({
    loanId: 'loan-accrual-active-1',
    customerId: 'cust-4',
    productCode: 'PL',
    principalCents: 100000,
    annualInterestRateBps: 1000,
    currency: 'USD',
    termMonths: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
    externalLoanId: 'loan-ext-4'
  }));
  await harness.postgresAdapter.updateLoanAccountStatus('loan-accrual-active-1', 'ACTIVE');

  await harness.postgresAdapter.insertLoan(buildLoan({
    loanId: 'loan-accrual-closed-1',
    customerId: 'cust-5',
    productCode: 'PL',
    principalCents: 100000,
    annualInterestRateBps: 1000,
    currency: 'USD',
    termMonths: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
    externalLoanId: 'loan-ext-5'
  }));
  await harness.postgresAdapter.updateLoanAccountStatus('loan-accrual-closed-1', 'CLOSED');

  await harness.postgresAdapter.insertLoan(buildLoan({
    loanId: 'loan-accrual-created-1',
    customerId: 'cust-6',
    productCode: 'PL',
    principalCents: 100000,
    annualInterestRateBps: 1000,
    currency: 'USD',
    termMonths: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
    externalLoanId: 'loan-ext-6'
  }));

  const result = await harness.application.runAccrualForMode({
    accrualMode: 'DAILY',
    accrualDate: '2026-02-11'
  });

  assert.equal(result.processed, 1);
  assert.equal(result.inactiveSkipped, 2);
});

test('malformed data fails safely', async () => {
  const harness = createHarness();

  await harness.postgresAdapter.insertLoan(buildLoan({
    loanId: 'loan-accrual-invalid-1',
    customerId: 'cust-7',
    productCode: 'PL',
    principalCents: 100000,
    annualInterestRateBps: -1,
    currency: 'USD',
    termMonths: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
    externalLoanId: 'loan-ext-7'
  }));
  await harness.postgresAdapter.updateLoanAccountStatus('loan-accrual-invalid-1', 'ACTIVE');

  const result = await harness.application.runAccrualForMode({
    accrualMode: 'DAILY',
    accrualDate: '2026-02-12'
  });

  assert.equal(result.failures, 1);
  assert.equal(result.processed, 0);
  assert.equal(harness.metrics.accrualFailures, 1);
});

test('accrual event is emitted', async () => {
  const harness = createHarness();

  await harness.postgresAdapter.insertLoan(buildLoan({
    loanId: 'loan-accrual-event-1',
    customerId: 'cust-8',
    productCode: 'PL',
    principalCents: 365000,
    annualInterestRateBps: 1000,
    currency: 'USD',
    termMonths: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
    externalLoanId: 'loan-ext-8'
  }));
  await harness.postgresAdapter.updateLoanAccountStatus('loan-accrual-event-1', 'ACTIVE');

  await harness.application.runAccrualForMode({
    accrualMode: 'DAILY',
    accrualDate: '2026-02-13',
    correlationId: 'corr-accrual-event-1'
  });

  const published = harness.kafkaProducer.events.find((event) => event.type === 'loan.interest.accrued.v1');
  assert.ok(published);
  assert.equal(published?.metadata.correlationId, 'corr-accrual-event-1');
  assert.equal(published?.payload.loanAccountId, 'loan-accrual-event-1');
  assert.equal(published?.payload.accrualMode, 'DAILY');
});
