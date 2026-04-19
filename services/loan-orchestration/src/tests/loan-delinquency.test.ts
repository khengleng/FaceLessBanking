import assert from 'node:assert/strict';
import test from 'node:test';

import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresLoanAdapter } from '../adapters/postgres-loan.adapter.js';
import { WorkflowAdapterStub } from '../adapters/workflow.adapter.js';
import { buildLoanDelinquencyApplication } from '../application/build-loan-delinquency.application.js';
import { buildLoan } from '../domain/loan.js';
import { LoanEventsPublisher } from '../events/loan.events.js';

function createHarness() {
  const postgresAdapter = new PostgresLoanAdapter();
  const kafkaProducer = new KafkaProducerAdapter();
  const loanEvents = new LoanEventsPublisher(kafkaProducer);
  const workflowAdapter = new WorkflowAdapterStub();

  const built = buildLoanDelinquencyApplication({
    postgresAdapter,
    loanEvents,
    workflowAdapter
  });

  return {
    application: built.application,
    postgresAdapter,
    workflowAdapter,
    kafkaProducer,
    metrics: built.metrics
  };
}

test('overdue loan triggers delinquency', async () => {
  const harness = createHarness();

  const loan = buildLoan({
    loanId: 'loan-delinquent-1',
    customerId: 'cust-delinquent-1',
    productCode: 'PL',
    principalCents: 100000,
    currency: 'USD',
    termMonths: 12,
    createdAt: new Date().toISOString(),
    externalLoanId: 'loan-external-delinquent-1'
  });
  await harness.postgresAdapter.insertLoan(loan);
  await harness.postgresAdapter.updateLoanStatus(loan.loanId, 'ACTIVE');

  const result = await harness.application.runDetection('corr-delinquency-1');

  assert.equal(result.scanned, 1);
  assert.equal(result.markedDelinquent, 1);

  const updated = await harness.postgresAdapter.getLoanAccountById(loan.loanId);
  assert.equal(updated?.status, 'DELINQUENT');
  assert.equal(harness.metrics.delinquentLoansMarked, 1);
});

test('case created for delinquent loan', async () => {
  const harness = createHarness();

  const loan = buildLoan({
    loanId: 'loan-delinquent-2',
    customerId: 'cust-delinquent-2',
    productCode: 'PL',
    principalCents: 200000,
    currency: 'USD',
    termMonths: 24,
    createdAt: new Date().toISOString(),
    externalLoanId: 'loan-external-delinquent-2'
  });
  await harness.postgresAdapter.insertLoan(loan);
  await harness.postgresAdapter.updateLoanStatus(loan.loanId, 'ACTIVE');

  await harness.application.runDetection('corr-delinquency-2');

  assert.equal(harness.workflowAdapter.requests.length, 1);
  assert.equal(harness.workflowAdapter.requests[0]?.loanAccountId, loan.loanId);

  const event = harness.kafkaProducer.events.find((item) => item.type === 'loan.delinquent.v1');
  assert.ok(event);
  assert.equal(event?.payload.loanAccountId, loan.loanId);
});

test('duplicate detection skipped', async () => {
  const harness = createHarness();

  const loan = buildLoan({
    loanId: 'loan-delinquent-3',
    customerId: 'cust-delinquent-3',
    productCode: 'PL',
    principalCents: 300000,
    currency: 'USD',
    termMonths: 18,
    createdAt: new Date().toISOString(),
    externalLoanId: 'loan-external-delinquent-3'
  });
  await harness.postgresAdapter.insertLoan(loan);
  await harness.postgresAdapter.updateLoanStatus(loan.loanId, 'DELINQUENT');

  const result = await harness.application.runDetection('corr-delinquency-3');

  assert.equal(result.scanned, 1);
  assert.equal(result.markedDelinquent, 0);
  assert.equal(result.duplicateSkipped, 1);
  assert.equal(harness.metrics.duplicateDelinquencySkipped, 1);
  assert.equal(harness.workflowAdapter.requests.length, 0);
});

test('safe handling of empty dataset', async () => {
  const harness = createHarness();

  const result = await harness.application.runDetection('corr-delinquency-empty');

  assert.equal(result.scanned, 0);
  assert.equal(result.markedDelinquent, 0);
  assert.equal(result.duplicateSkipped, 0);
  assert.equal(harness.metrics.emptyOverdueDatasetRuns, 1);
  assert.equal(harness.workflowAdapter.requests.length, 0);
});
