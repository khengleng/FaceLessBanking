import assert from 'node:assert/strict';
import test from 'node:test';
import { TreasuryApplication } from '../application/treasury.application.js';
import { PostgresTreasuryAdapter } from '../adapters/postgres-treasury.adapter.js';
import { PaymentOrchestrationAdapterStub } from '../adapters/payment-orchestration.adapter.js';

test('Treasury Operations Flow', async (t) => {
  const postgresAdapter = new PostgresTreasuryAdapter();
  const paymentAdapter = new PaymentOrchestrationAdapterStub();
  const logger = { info: () => {}, warn: () => {}, error: () => {} };
  const app = new TreasuryApplication(postgresAdapter, paymentAdapter, logger);

  // Setup treasury accounts
  const acc1 = 'gl-reserve-usd';
  const acc2 = 'gl-funding-usd';
  
  await app.createAccount({ accountId: acc1, name: 'Reserve', category: 'RESERVE', currency: 'USD', status: 'ACTIVE' });
  await app.createAccount({ accountId: acc2, name: 'Funding', category: 'LOAN_FUNDING', currency: 'USD', status: 'ACTIVE' });

  await t.test('initiate internal rebalance successfully', async () => {
    const transfer = await app.initiateRebalance({
      sourceAccountId: acc1,
      destinationAccountId: acc2,
      amountCents: 1000000n, // $10,000
      currency: 'USD',
      purpose: 'Fund loan disbursement pool'
    });

    assert.equal(transfer.status, 'COMPLETED');
    assert.equal(transfer.amountCents, 1000000n);
  });

  await t.test('fail on currency mismatch', async () => {
    await assert.rejects(
      app.initiateRebalance({
        sourceAccountId: acc1,
        destinationAccountId: acc2,
        amountCents: 5000n,
        currency: 'EUR', // Mismatch with accounts
        purpose: 'Test'
      }),
      /Currency mismatch/
    );
  });

  await t.test('fail on unknown account', async () => {
    await assert.rejects(
      app.initiateRebalance({
        sourceAccountId: acc1,
        destinationAccountId: 'INVALID',
        amountCents: 5000n,
        currency: 'USD',
        purpose: 'Test'
      }),
      /not found/
    );
  });
});
