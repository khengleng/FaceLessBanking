import assert from 'node:assert/strict';
import test from 'node:test';

import {
  InMemoryAlmEngineAdapter,
  InMemoryKafkaProfitabilityAdapter,
  InMemoryPostgresProfitabilityAdapter
} from '../adapters/profitability-adapters.js';
import { ProfitabilityApplication } from '../application/profitability.application.js';

function buildHarness() {
  const postgres = new InMemoryPostgresProfitabilityAdapter();
  const kafka = new InMemoryKafkaProfitabilityAdapter();
  const alm = new InMemoryAlmEngineAdapter();
  const logger = {
    info: (): void => {},
    warn: (): void => {},
    error: (): void => {}
  };

  const application = new ProfitabilityApplication(postgres, kafka, alm, logger);
  return { application, postgres, kafka, alm };
}

test('revenue correctly attributed from loan.interest.accrued.v1', async () => {
  const { application, kafka } = buildHarness();

  const result = await application.processFinancialEvent({
    specVersion: '1.0',
    type: 'loan.interest.accrued.v1',
    version: 1,
    metadata: {
      eventId: 'evt-interest-1',
      correlationId: 'corr-interest-1',
      timestamp: '2026-04-17T10:00:00.000Z',
      producer: 'loan-orchestration'
    },
    payload: {
      loanAccountId: 'loan-001',
      accruedInterest: 125.5,
      currency: 'USD'
    }
  });

  assert.equal(result.processed, true);
  assert.equal(result.record?.category, 'INTEREST_INCOME');
  assert.equal(result.record?.amount, 125.5);
  assert.equal(result.record?.relatedEntityId, 'loan-001');
  assert.equal(kafka.publishedEvents.length, 1);
  assert.equal(kafka.publishedEvents[0]?.type, 'profitability.record.created.v1');
});

test('duplicate event skipped idempotently', async () => {
  const { application, postgres } = buildHarness();

  const event = {
    specVersion: '1.0',
    type: 'fee.collected.v1',
    version: 1,
    metadata: {
      eventId: 'evt-fee-duplicate',
      correlationId: 'corr-fee-duplicate',
      timestamp: '2026-04-17T10:10:00.000Z',
      producer: 'fee-charge-engine'
    },
    payload: {
      paymentId: 'pay-001',
      assessedAmountCents: 500,
      currency: 'USD'
    }
  } as const;

  await application.processFinancialEvent(event);
  const second = await application.processFinancialEvent(event);

  assert.equal(second.processed, false);

  const records = await postgres.listRevenueCostRecords();
  assert.equal(records.length, 1);
  assert.equal(records[0]?.sourceEventId, 'evt-fee-duplicate');
});

test('multiple categories handled deterministically', async () => {
  const { application, postgres } = buildHarness();

  await application.processFinancialEvent({
    specVersion: '1.0',
    type: 'fee.collected.v1',
    version: 1,
    metadata: {
      eventId: 'evt-fee-1',
      correlationId: 'corr-fee-1',
      timestamp: '2026-04-17T11:00:00.000Z',
      producer: 'fee-charge-engine'
    },
    payload: {
      paymentId: 'pay-fee-1',
      assessedAmountCents: 250,
      currency: 'USD'
    }
  });

  await application.processFinancialEvent({
    specVersion: '1.0',
    type: 'payment.status.updated.v1',
    version: 1,
    metadata: {
      eventId: 'evt-payment-1',
      correlationId: 'corr-payment-1',
      timestamp: '2026-04-17T11:05:00.000Z',
      producer: 'payment-orchestration'
    },
    payload: {
      paymentId: 'pay-100',
      amount: 1000,
      currency: 'USD',
      status: 'COMPLETED'
    }
  });

  await application.processFinancialEvent({
    specVersion: '1.0',
    type: 'fx.rate.applied',
    version: 1,
    metadata: {
      eventId: 'evt-fx-1',
      correlationId: 'corr-fx-1',
      timestamp: '2026-04-17T11:06:00.000Z',
      producer: 'pricing-engine'
    },
    payload: {
      paymentId: 'pay-fx-1',
      spreadAmount: 7.25,
      currency: 'USD'
    }
  });

  const records = await postgres.listRevenueCostRecords();
  assert.equal(records.length, 3);

  const categories = records.map((record) => record.category).sort();
  assert.deepEqual(categories, ['FEE_INCOME', 'FUNDING_COST', 'FX_INCOME']);

  const fundingCost = records.find((record) => record.category === 'FUNDING_COST');
  assert.equal(fundingCost?.amount, 1);
});

test('customer profitability correct', async () => {
  const { application, postgres } = buildHarness();

  postgres.setEntityOwnership('loan-cust-1', { customerId: 'cust-1', productType: 'LOAN' });
  postgres.setEntityOwnership('pay-cust-1', { customerId: 'cust-1', productType: 'PAYMENT' });

  await application.processFinancialEvent({
    specVersion: '1.0',
    type: 'loan.interest.accrued.v1',
    version: 1,
    metadata: {
      eventId: 'evt-customer-interest',
      correlationId: 'corr-customer-interest',
      timestamp: '2026-04-17T12:00:00.000Z',
      producer: 'loan-orchestration'
    },
    payload: {
      loanAccountId: 'loan-cust-1',
      accruedInterest: 100,
      currency: 'USD'
    }
  });

  await application.processFinancialEvent({
    specVersion: '1.0',
    type: 'payment.status.updated.v1',
    version: 1,
    metadata: {
      eventId: 'evt-customer-funding',
      correlationId: 'corr-customer-funding',
      timestamp: '2026-04-17T12:01:00.000Z',
      producer: 'payment-orchestration'
    },
    payload: {
      paymentId: 'pay-cust-1',
      amount: 1000,
      currency: 'USD',
      status: 'COMPLETED'
    }
  });

  const view = await application.getCustomerProfitability('cust-1');
  assert.deepEqual(view, {
    entityId: 'cust-1',
    totalRevenue: 100,
    totalCost: 1,
    netProfit: 99,
    currency: 'USD'
  });
});

test('product profitability correct', async () => {
  const { application, postgres } = buildHarness();

  postgres.setEntityOwnership('pay-a', { customerId: 'cust-a', productType: 'PAYMENT' });
  postgres.setEntityOwnership('pay-b', { customerId: 'cust-b', productType: 'PAYMENT' });

  await application.processFinancialEvent({
    specVersion: '1.0',
    type: 'fee.collected.v1',
    version: 1,
    metadata: {
      eventId: 'evt-product-fee',
      correlationId: 'corr-product-fee',
      timestamp: '2026-04-17T13:00:00.000Z',
      producer: 'fee-charge-engine'
    },
    payload: {
      paymentId: 'pay-a',
      assessedAmountCents: 300,
      currency: 'USD'
    }
  });

  await application.processFinancialEvent({
    specVersion: '1.0',
    type: 'payment.status.updated.v1',
    version: 1,
    metadata: {
      eventId: 'evt-product-funding',
      correlationId: 'corr-product-funding',
      timestamp: '2026-04-17T13:01:00.000Z',
      producer: 'payment-orchestration'
    },
    payload: {
      paymentId: 'pay-b',
      amount: 500,
      currency: 'USD',
      status: 'COMPLETED'
    }
  });

  const view = await application.getProductProfitability('PAYMENT');
  assert.deepEqual(view, {
    entityId: 'PAYMENT',
    totalRevenue: 300,
    totalCost: 0.5,
    netProfit: 299.5,
    currency: 'USD'
  });
});

test('empty dataset safe handling returns zero view', async () => {
  const { application } = buildHarness();

  const customerView = await application.getCustomerProfitability('missing-customer');
  assert.deepEqual(customerView, {
    entityId: 'missing-customer',
    totalRevenue: 0,
    totalCost: 0,
    netProfit: 0,
    currency: 'USD'
  });

  const productView = await application.getProductProfitability('MISSING_PRODUCT');
  assert.deepEqual(productView, {
    entityId: 'MISSING_PRODUCT',
    totalRevenue: 0,
    totalCost: 0,
    netProfit: 0,
    currency: 'USD'
  });
});

test('P&L calculation correct', async () => {
  const { application } = buildHarness();

  await application.processFinancialEvent({
    specVersion: '1.0',
    type: 'loan.interest.accrued.v1',
    version: 1,
    metadata: {
      eventId: 'evt-pnl-interest',
      correlationId: 'corr-pnl-interest',
      timestamp: '2026-04-17T14:00:00.000Z',
      producer: 'loan-orchestration'
    },
    payload: {
      loanAccountId: 'loan-pnl-1',
      accruedInterest: 200,
      currency: 'USD'
    }
  });

  await application.processFinancialEvent({
    specVersion: '1.0',
    type: 'fee.collected.v1',
    version: 1,
    metadata: {
      eventId: 'evt-pnl-fee',
      correlationId: 'corr-pnl-fee',
      timestamp: '2026-04-17T14:01:00.000Z',
      producer: 'fee-charge-engine'
    },
    payload: {
      paymentId: 'pay-pnl-fee',
      assessedAmountCents: 25,
      currency: 'USD'
    }
  });

  await application.processFinancialEvent({
    specVersion: '1.0',
    type: 'fx.rate.applied',
    version: 1,
    metadata: {
      eventId: 'evt-pnl-fx',
      correlationId: 'corr-pnl-fx',
      timestamp: '2026-04-17T14:02:00.000Z',
      producer: 'pricing-engine'
    },
    payload: {
      paymentId: 'pay-pnl-fx',
      spreadAmount: 10,
      currency: 'USD'
    }
  });

  await application.processFinancialEvent({
    specVersion: '1.0',
    type: 'payment.status.updated.v1',
    version: 1,
    metadata: {
      eventId: 'evt-pnl-cost',
      correlationId: 'corr-pnl-cost',
      timestamp: '2026-04-17T14:03:00.000Z',
      producer: 'payment-orchestration'
    },
    payload: {
      paymentId: 'pay-pnl-cost',
      amount: 1000,
      currency: 'USD',
      status: 'COMPLETED'
    }
  });

  const pnl = await application.getBankPnL('USD');
  assert.equal(pnl.totalInterestIncome, 200);
  assert.equal(pnl.totalFeeIncome, 25);
  assert.equal(pnl.totalFxIncome, 10);
  assert.equal(pnl.totalCost, 1);
  assert.equal(pnl.netProfit, 234);
  assert.equal(pnl.currency, 'USD');
  assert.equal(pnl.calculatedAt, '2026-04-17T14:03:00.000Z');
});

test('margin metrics correct', async () => {
  const { application, alm } = buildHarness();
  alm.setTotals({ currency: 'USD', assets: 1000, liabilities: 500 });

  await application.processFinancialEvent({
    specVersion: '1.0',
    type: 'loan.interest.accrued.v1',
    version: 1,
    metadata: {
      eventId: 'evt-margin-interest',
      correlationId: 'corr-margin-interest',
      timestamp: '2026-04-17T15:00:00.000Z',
      producer: 'loan-orchestration'
    },
    payload: {
      loanAccountId: 'loan-margin-1',
      accruedInterest: 100,
      currency: 'USD'
    }
  });

  await application.processFinancialEvent({
    specVersion: '1.0',
    type: 'payment.status.updated.v1',
    version: 1,
    metadata: {
      eventId: 'evt-margin-cost',
      correlationId: 'corr-margin-cost',
      timestamp: '2026-04-17T15:01:00.000Z',
      producer: 'payment-orchestration'
    },
    payload: {
      paymentId: 'pay-margin-cost',
      amount: 500,
      currency: 'USD',
      status: 'COMPLETED'
    }
  });

  const margins = await application.getMarginMetrics('USD');
  assert.equal(margins.netInterestMargin, 0.1);
  assert.equal(margins.costOfFunds, 0.001);
  assert.equal(margins.yieldOnAssets, 0.1);
});

test('edge cases handled for divide-by-zero safely', async () => {
  const { application, alm } = buildHarness();
  alm.setTotals({ currency: 'USD', assets: 0, liabilities: 0 });

  await application.processFinancialEvent({
    specVersion: '1.0',
    type: 'loan.interest.accrued.v1',
    version: 1,
    metadata: {
      eventId: 'evt-edge-interest',
      correlationId: 'corr-edge-interest',
      timestamp: '2026-04-17T16:00:00.000Z',
      producer: 'loan-orchestration'
    },
    payload: {
      loanAccountId: 'loan-edge-1',
      accruedInterest: 50,
      currency: 'USD'
    }
  });

  const margins = await application.getMarginMetrics('USD');
  assert.equal(margins.netInterestMargin, null);
  assert.equal(margins.costOfFunds, null);
  assert.equal(margins.yieldOnAssets, null);
});
