import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildErrorResponse,
  buildNotFoundError,
  buildPageMeta,
  buildSuccessResponse,
  buildValidationError,
  toAccountId,
  toCorrelationId,
  toCustomerId,
  toLoanId,
  toPaymentId,
  type AccountId,
  type CustomerId,
  type LoanId,
  type PaymentId
} from '../index.js';

test('identifier helpers return branded ids', () => {
  const customerId: CustomerId = toCustomerId('cust_123');
  const accountId: AccountId = toAccountId('acct_123');
  const loanId: LoanId = toLoanId('loan_123');
  const paymentId: PaymentId = toPaymentId('pay_123');

  assert.equal(customerId, 'cust_123');
  assert.equal(accountId, 'acct_123');
  assert.equal(loanId, 'loan_123');
  assert.equal(paymentId, 'pay_123');
});

test('api envelope builders create consistent success and error shapes', () => {
  const correlationId = toCorrelationId('corr_1');

  const success = buildSuccessResponse({
    data: { value: 42 },
    meta: { source: 'test' },
    correlationId
  });

  assert.equal(success.success, true);
  assert.equal(success.data.value, 42);
  assert.equal(success.meta?.source, 'test');
  assert.equal(success.correlationId, 'corr_1');

  const error = buildErrorResponse({
    error: buildValidationError({ details: ['missing field'] }),
    correlationId
  });

  assert.equal(error.success, false);
  assert.equal(error.error.code, 'validation_failed');
  assert.deepEqual(error.error.details, ['missing field']);
  assert.equal(error.correlationId, 'corr_1');
});

test('pagination and common error helpers are reusable', () => {
  const pageMeta = buildPageMeta({ page: 2, pageSize: 10, totalItems: 25 });
  assert.equal(pageMeta.totalPages, 3);

  const notFound = buildNotFoundError();
  assert.equal(notFound.code, 'not_found');
  assert.equal(notFound.retriable, false);
});
