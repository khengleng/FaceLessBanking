import assert from 'node:assert/strict';
import test from 'node:test';

import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { createApp } from '../app.js';
import { buildLoan } from '../domain/loan.js';
import { LoanEventsPublisher } from '../events/loan.events.js';

test('POST /loans creates loan on happy path', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/loans',
    headers: {
      'x-idempotency-key': 'idem-loan-happy'
    },
    payload: {
      customerId: 'cust-123',
      productCode: 'PL',
      principalCents: 500000,
      currency: 'USD',
      termMonths: 24
    }
  });

  assert.equal(response.statusCode, 201);

  const payload = response.json() as {
    loanId: string;
    customerId: string;
    status: string;
    externalLoanId: string;
  };

  assert.ok(payload.loanId.length > 0);
  assert.equal(payload.customerId, 'cust-123');
  assert.equal(payload.status, 'CREATED');
  assert.ok(payload.externalLoanId.startsWith('loan-application-'));

  await app.close();
});

test('POST /loans rejects invalid payload', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/loans',
    headers: {
      'x-idempotency-key': 'idem-loan-invalid'
    },
    payload: {
      customerId: 'x',
      productCode: '',
      principalCents: 0,
      currency: 'US',
      termMonths: 0
    }
  });

  assert.equal(response.statusCode, 400);
  const payload = response.json() as {
    error: string;
    details: string[];
  };

  assert.equal(payload.error, 'validation_failed');
  assert.ok(payload.details.length > 0);

  await app.close();
});

test('POST /loans returns rule rejection placeholder when eligibility fails', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/loans',
    headers: {
      'x-idempotency-key': 'idem-loan-rule-reject'
    },
    payload: {
      customerId: 'cust-999',
      productCode: 'PL',
      principalCents: 1_500_000,
      currency: 'USD',
      termMonths: 24
    }
  });

  assert.equal(response.statusCode, 422);
  const payload = response.json() as {
    error: string;
    reason: string;
  };

  assert.equal(payload.error, 'loan_rule_rejected');
  assert.equal(payload.reason, 'principal_exceeds_placeholder_threshold');

  await app.close();
});

test('GET /loans/:loanId returns loan by id', async () => {
  const app = createApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/loans',
    headers: {
      'x-idempotency-key': 'idem-loan-get'
    },
    payload: {
      customerId: 'cust-321',
      productCode: 'PL',
      principalCents: 250000,
      currency: 'USD',
      termMonths: 12
    }
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json() as { loanId: string; customerId: string };

  const getResponse = await app.inject({
    method: 'GET',
    url: `/loans/${created.loanId}`
  });

  assert.equal(getResponse.statusCode, 200);
  const payload = getResponse.json() as { loanId: string; customerId: string };

  assert.equal(payload.loanId, created.loanId);
  assert.equal(payload.customerId, 'cust-321');

  await app.close();
});

test('POST /loans/:loanId/repayments initiates repayment on happy path', async () => {
  const app = createApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/loans',
    headers: {
      'x-idempotency-key': 'idem-loan-repay-parent'
    },
    payload: {
      customerId: 'cust-654',
      productCode: 'PL',
      principalCents: 900000,
      currency: 'USD',
      termMonths: 36
    }
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json() as { loanId: string };

  const repaymentResponse = await app.inject({
    method: 'POST',
    url: `/loans/${created.loanId}/repayments`,
    headers: {
      'x-idempotency-key': 'idem-repay-happy'
    },
    payload: {
      amountCents: 12000,
      currency: 'USD',
      sourceAccountId: 'customer-account-654'
    }
  });

  assert.equal(repaymentResponse.statusCode, 201);
  const payload = repaymentResponse.json() as {
    repaymentId: string;
    loanAccountId: string;
    amountCents: number;
    status: string;
    paymentId: string;
  };

  assert.ok(payload.repaymentId.length > 0);
  assert.equal(payload.loanAccountId, created.loanId);
  assert.equal(payload.amountCents, 12000);
  assert.equal(payload.status, 'INITIATED');
  assert.ok(payload.paymentId.startsWith('payment-'));

  await app.close();
});

test('POST /loans returns duplicate idempotency placeholder behavior', async () => {
  const app = createApp();

  const requestConfig = {
    method: 'POST' as const,
    url: '/loans',
    headers: {
      'x-idempotency-key': 'idem-loan-dup'
    },
    payload: {
      customerId: 'cust-888',
      productCode: 'PL',
      principalCents: 100000,
      currency: 'USD',
      termMonths: 6
    }
  };

  const first = await app.inject(requestConfig);
  assert.equal(first.statusCode, 201);

  const second = await app.inject(requestConfig);
  assert.equal(second.statusCode, 409);

  const payload = second.json() as {
    error: string;
    referenceId: string;
  };

  assert.equal(payload.error, 'duplicate_idempotency_key');
  assert.ok(payload.referenceId.length > 0);

  await app.close();
});

test('loan.created.v1 event is constructed and published with canonical envelope', async () => {
  const kafkaProducer = new KafkaProducerAdapter();
  const publisher = new LoanEventsPublisher(kafkaProducer);

  const loan = buildLoan({
    loanId: 'loan-evt-1',
    customerId: 'cust-evt-1',
    productCode: 'PL',
    principalCents: 250000,
    currency: 'USD',
    termMonths: 12,
    createdAt: new Date().toISOString(),
    externalLoanId: 'fineract-loan-evt-1'
  });

  await publisher.emitLoanCreated(loan);

  assert.equal(kafkaProducer.events.length, 1);
  assert.equal(kafkaProducer.events[0]?.type, 'loan.created.v1');
  assert.equal(kafkaProducer.events[0]?.version, 1);
  assert.equal(kafkaProducer.events[0]?.metadata.producer, 'loan-orchestration');
  assert.equal(kafkaProducer.events[0]?.payload.loanId, loan.loanId);
});
