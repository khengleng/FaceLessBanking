import assert from 'node:assert/strict';
import test from 'node:test';
import { TreasuryOperationsApplication } from '../application/treasury-operations.application.js';
import { PostgresTreasuryAdapter } from '../adapters/postgres-treasury.adapter.js';
import { PaymentOrchestrationAdapterStub } from '../adapters/payment-orchestration.adapter.js';
import type { TreasuryEventsPublisher } from '../events/treasury-publisher.js';

test('Treasury Operations Business Logic', async (t) => {
  const postgresAdapter = new PostgresTreasuryAdapter();
  const paymentAdapter = new PaymentOrchestrationAdapterStub();
  let eventEmitted = false;
  const eventPublisher: Pick<TreasuryEventsPublisher, 'emitTransferInitiated'> = {
    emitTransferInitiated: async () => { eventEmitted = true; }
  };
  const logger = { info: () => {}, warn: () => {}, error: () => {} };
  
  const app = new TreasuryOperationsApplication(
    postgresAdapter,
    paymentAdapter,
    eventPublisher,
    logger
  );

  // Setup treasury accounts
  const settlementAcc = 'acc-settlement-1';
  const fundingAcc = 'acc-funding-1';
  
  await postgresAdapter.saveTreasuryAccount({
    accountId: settlementAcc,
    currency: 'USD',
    balanceCents: 500000n, // $5,000
    type: 'SETTLEMENT'
  });

  await postgresAdapter.saveTreasuryAccount({
    accountId: fundingAcc,
    currency: 'USD',
    balanceCents: 100000n, // $1,000
    type: 'FUNDING'
  });

  await t.test('successful rebalance with sufficient liquidity', async () => {
    const transfer = await app.initiateTransfer({
      fromAccount: settlementAcc,
      toAccount: fundingAcc,
      amountCents: 200000n, // $2,000
      currency: 'USD'
    });

    assert.equal(transfer.status, 'INITIATED');
    assert.equal(eventEmitted, true);
  });

  await t.test('fail on insufficient liquidity', async () => {
    await assert.rejects(
      app.initiateTransfer({
        fromAccount: settlementAcc,
        toAccount: fundingAcc,
        amountCents: 1000000n, // $10,000 (More than $5,000 balance)
        currency: 'USD'
      }),
      /Insufficient liquidity/
    );
  });

  await t.test('idempotency: duplicate requestId returns existing transfer', async () => {
    const requestId = 'req-unique-123';
    
    // First call
    const t1 = await app.initiateTransfer({
      fromAccount: settlementAcc,
      toAccount: fundingAcc,
      amountCents: 100n,
      currency: 'USD',
      idempotencyKey: requestId
    });

    // Second call with same requestId
    const t2 = await app.initiateTransfer({
      fromAccount: settlementAcc,
      toAccount: fundingAcc,
      amountCents: 100000n, // Different amount, but same requestId
      currency: 'USD',
      idempotencyKey: requestId
    });

    assert.equal(t1.transferId, t2.transferId);
    assert.equal(t1.amountCents, 100n); // Original amount preserved
    assert.equal(t2.amountCents, 100n);
  });

  await t.test('fail on currency mismatch', async () => {
    await assert.rejects(
      app.initiateTransfer({
        fromAccount: settlementAcc,
        toAccount: fundingAcc,
        amountCents: 100n,
        currency: 'EUR'
      }),
      /Currency mismatch/
    );
  });
});
