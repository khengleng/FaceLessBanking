import assert from 'node:assert/strict';
import test from 'node:test';

import { PaymentAdapterStub } from '../adapters/payment.adapter.js';
import { PostgresLoanAdapter } from '../adapters/postgres-loan.adapter.js';
import { buildLoanDisbursementApplication } from '../application/build-loan-disbursement.application.js';
import { buildLoan } from '../domain/loan.js';
import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { LoanEventsPublisher } from '../events/loan.events.js';

function buildLoanAccountCreatedEvent(input: {
  eventId: string;
  loanAccountId: string;
  customerAccountId: string;
  fundingAccountId?: string;
  amountCents?: number;
  currency?: string;
  correlationId?: string;
}) {
  return {
    specVersion: '1.0',
    type: 'loan.account.created.v1',
    version: 1,
    metadata: {
      eventId: input.eventId,
      correlationId: input.correlationId ?? 'corr-loan-disbursement',
      timestamp: new Date().toISOString(),
      producer: 'loan-orchestration'
    },
    payload: {
      loanAccountId: input.loanAccountId,
      customerAccountId: input.customerAccountId,
      fundingAccountId: input.fundingAccountId,
      disbursementAmountCents: input.amountCents,
      currency: input.currency
    }
  };
}

function createHarness() {
  const postgresAdapter = new PostgresLoanAdapter();
  const kafkaProducer = new KafkaProducerAdapter();
  const loanEvents = new LoanEventsPublisher(kafkaProducer);
  const paymentAdapter = new PaymentAdapterStub();

  const built = buildLoanDisbursementApplication({
    postgresAdapter,
    loanEvents,
    paymentAdapter,
    fundingAccountId: 'bank-funding-default'
  });

  return {
    postgresAdapter,
    kafkaProducer,
    paymentAdapter,
    metrics: built.metrics,
    application: built.application
  };
}

test('disbursement triggered on loan.account.created.v1', async () => {
  const harness = createHarness();

  const loan = buildLoan({
    loanId: 'loan-disb-1',
    customerId: 'cust-1',
    productCode: 'PL',
    principalCents: 75000,
    currency: 'USD',
    termMonths: 12,
    createdAt: new Date().toISOString(),
    externalLoanId: 'loan-external-1'
  });

  await harness.postgresAdapter.insertLoan(loan);

  const result = await harness.application.processLoanAccountCreated(buildLoanAccountCreatedEvent({
    eventId: 'evt-disb-1',
    loanAccountId: loan.loanId,
    customerAccountId: 'cust-account-1'
  }));

  assert.equal(result.kind, 'disbursement_initiated');
  assert.equal(harness.paymentAdapter.requests.length, 1);
  assert.equal(harness.paymentAdapter.requests[0]?.sourceAccountId, 'bank-funding-default');
  assert.equal(harness.paymentAdapter.requests[0]?.destinationAccountId, 'cust-account-1');

  const updated = await harness.postgresAdapter.getLoanAccountById(loan.loanId);
  assert.equal(updated?.status, 'DISBURSEMENT_PENDING');
  assert.equal(harness.metrics.disbursementsTriggered, 1);
});

test('duplicate event skipped', async () => {
  const harness = createHarness();

  const loan = buildLoan({
    loanId: 'loan-disb-2',
    customerId: 'cust-2',
    productCode: 'PL',
    principalCents: 51000,
    currency: 'USD',
    termMonths: 6,
    createdAt: new Date().toISOString(),
    externalLoanId: 'loan-external-2'
  });

  await harness.postgresAdapter.insertLoan(loan);

  const event = buildLoanAccountCreatedEvent({
    eventId: 'evt-disb-dup-1',
    loanAccountId: loan.loanId,
    customerAccountId: 'cust-account-2'
  });

  const first = await harness.application.processLoanAccountCreated(event);
  assert.equal(first.kind, 'disbursement_initiated');

  const second = await harness.application.processLoanAccountCreated(event);
  assert.equal(second.kind, 'duplicate_event');
  assert.equal(harness.paymentAdapter.requests.length, 1);
  assert.equal(harness.metrics.duplicateDisbursementEventsSkipped, 1);
});

test('invalid state blocked', async () => {
  const harness = createHarness();

  const loan = buildLoan({
    loanId: 'loan-disb-3',
    customerId: 'cust-3',
    productCode: 'PL',
    principalCents: 90000,
    currency: 'USD',
    termMonths: 18,
    createdAt: new Date().toISOString(),
    externalLoanId: 'loan-external-3'
  });

  await harness.postgresAdapter.insertLoan(loan);
  await harness.postgresAdapter.updateLoanAccountStatus(loan.loanId, 'DISBURSEMENT_PENDING');

  const result = await harness.application.processLoanAccountCreated(buildLoanAccountCreatedEvent({
    eventId: 'evt-disb-invalid-state',
    loanAccountId: loan.loanId,
    customerAccountId: 'cust-account-3'
  }));

  assert.equal(result.kind, 'invalid_state');
  assert.equal(harness.paymentAdapter.requests.length, 0);
  assert.equal(harness.metrics.invalidStateTransitionsBlocked, 1);
});

test('payment request created and loan.disbursement.initiated.v1 emitted', async () => {
  const harness = createHarness();

  const loan = buildLoan({
    loanId: 'loan-disb-4',
    customerId: 'cust-4',
    productCode: 'PL',
    principalCents: 100000,
    currency: 'USD',
    termMonths: 24,
    createdAt: new Date().toISOString(),
    externalLoanId: 'loan-external-4'
  });

  await harness.postgresAdapter.insertLoan(loan);

  const result = await harness.application.processLoanAccountCreated(buildLoanAccountCreatedEvent({
    eventId: 'evt-disb-publish',
    loanAccountId: loan.loanId,
    customerAccountId: 'cust-account-4',
    fundingAccountId: 'bank-funding-override',
    amountCents: 100000,
    currency: 'USD',
    correlationId: 'corr-disbursement-4'
  }));

  assert.equal(result.kind, 'disbursement_initiated');

  const disbursementRequests = harness.postgresAdapter.getDisbursementRequestsForTests();
  assert.equal(disbursementRequests.length, 1);
  assert.equal(disbursementRequests[0]?.loanAccountId, loan.loanId);
  assert.equal(disbursementRequests[0]?.sourceAccountId, 'bank-funding-override');

  const published = harness.kafkaProducer.events.find((event) => event.type === 'loan.disbursement.initiated.v1');
  assert.ok(published);
  assert.equal(published?.metadata.correlationId, 'corr-disbursement-4');
  assert.equal(published?.payload.loanId, loan.loanId);
  assert.equal(published?.payload.amountCents, 100000);
});
