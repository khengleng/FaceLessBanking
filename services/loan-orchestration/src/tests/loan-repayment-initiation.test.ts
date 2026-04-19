import assert from 'node:assert/strict';
import test from 'node:test';

import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PaymentAdapterStub } from '../adapters/payment.adapter.js';
import { PostgresLoanAdapter } from '../adapters/postgres-loan.adapter.js';
import { RedisIdempotencyAdapter } from '../adapters/redis-idempotency.adapter.js';
import { RulesEngineAdapterStub } from '../adapters/rules-engine.adapter.js';
import { LoanApplication } from '../application/loan.application.js';
import { buildLoan } from '../domain/loan.js';
import { AuditEventsService } from '../events/audit.events.js';
import { LoanEventsPublisher } from '../events/loan.events.js';

function createHarness() {
  const postgresAdapter = new PostgresLoanAdapter();
  const redisAdapter = new RedisIdempotencyAdapter();
  const paymentAdapter = new PaymentAdapterStub();
  const rulesEngineAdapter = new RulesEngineAdapterStub();
  const auditEvents = new AuditEventsService();
  const kafkaProducer = new KafkaProducerAdapter();
  const loanEvents = new LoanEventsPublisher(kafkaProducer);

  const application = new LoanApplication(
    postgresAdapter,
    redisAdapter,
    paymentAdapter,
    rulesEngineAdapter,
    auditEvents,
    loanEvents,
    'loan-funding-account-test'
  );

  return {
    application,
    postgresAdapter,
    paymentAdapter,
    kafkaProducer
  };
}

test('repayment request creates record', async () => {
  const harness = createHarness();

  const loan = buildLoan({
    loanId: 'loan-repay-1',
    customerId: 'cust-1',
    productCode: 'PL',
    principalCents: 100000,
    currency: 'USD',
    termMonths: 12,
    createdAt: new Date().toISOString(),
    externalLoanId: 'loan-external-1'
  });
  await harness.postgresAdapter.insertLoan(loan);

  const result = await harness.application.initiateRepayment(
    loan.loanId,
    {
      amountCents: 1000,
      currency: 'USD',
      sourceAccountId: 'customer-account-1'
    },
    'idem-repayment-record-1',
    'corr-repayment-record-1'
  );

  assert.equal(result.kind, 'created');
  if (result.kind !== 'created') {
    return;
  }

  const repayment = await harness.postgresAdapter.findRepaymentById(result.repayment.repaymentId);
  assert.ok(repayment);
  assert.equal(repayment?.loanAccountId, loan.loanId);
  assert.equal(repayment?.status, 'INITIATED');
});

test('payment triggered for repayment flow', async () => {
  const harness = createHarness();

  const loan = buildLoan({
    loanId: 'loan-repay-2',
    customerId: 'cust-2',
    productCode: 'PL',
    principalCents: 100000,
    currency: 'USD',
    termMonths: 12,
    createdAt: new Date().toISOString(),
    externalLoanId: 'loan-external-2'
  });
  await harness.postgresAdapter.insertLoan(loan);

  const result = await harness.application.initiateRepayment(
    loan.loanId,
    {
      amountCents: 1500,
      currency: 'USD',
      sourceAccountId: 'customer-account-2'
    },
    'idem-repayment-payment-1',
    'corr-repayment-payment-1'
  );

  assert.equal(result.kind, 'created');
  assert.equal(harness.paymentAdapter.requests.length, 1);
  assert.equal(harness.paymentAdapter.requests[0]?.sourceAccountId, 'customer-account-2');
  assert.equal(harness.paymentAdapter.requests[0]?.destinationAccountId, 'loan-funding-account-test');
});

test('duplicate request handled safely', async () => {
  const harness = createHarness();

  const loan = buildLoan({
    loanId: 'loan-repay-3',
    customerId: 'cust-3',
    productCode: 'PL',
    principalCents: 100000,
    currency: 'USD',
    termMonths: 12,
    createdAt: new Date().toISOString(),
    externalLoanId: 'loan-external-3'
  });
  await harness.postgresAdapter.insertLoan(loan);

  const payload = {
    amountCents: 2500,
    currency: 'USD',
    sourceAccountId: 'customer-account-3'
  };

  const first = await harness.application.initiateRepayment(
    loan.loanId,
    payload,
    'idem-repayment-dup-1',
    'corr-repayment-dup-1'
  );
  assert.equal(first.kind, 'created');

  const second = await harness.application.initiateRepayment(
    loan.loanId,
    payload,
    'idem-repayment-dup-1',
    'corr-repayment-dup-1'
  );

  assert.equal(second.kind, 'duplicate_idempotency');
  assert.equal(harness.paymentAdapter.requests.length, 1);
});

test('invalid loan handled safely', async () => {
  const harness = createHarness();

  const result = await harness.application.initiateRepayment(
    'loan-missing-1',
    {
      amountCents: 3000,
      currency: 'USD',
      sourceAccountId: 'customer-account-missing'
    },
    'idem-repayment-missing-1',
    'corr-repayment-missing-1'
  );

  assert.equal(result.kind, 'loan_not_found');
  assert.equal(harness.paymentAdapter.requests.length, 0);
});
