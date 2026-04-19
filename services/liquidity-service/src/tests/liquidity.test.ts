import assert from 'node:assert/strict';
import test from 'node:test';
import { LiquidityApplication } from '../application/liquidity.application.js';
import { PostgresLiquidityAdapter } from '../adapters/postgres-liquidity.adapter.js';

test('Liquidity Management Flow', async (t) => {
  const postgresAdapter = new PostgresLiquidityAdapter();
  const logger = { info: () => {}, warn: () => {}, error: () => {} };
  const app = new LiquidityApplication(postgresAdapter, logger);

  await t.test('payment IN increases available liquidity', async () => {
    await app.processFinancialEvent({
      metadata: { eventId: 'evt-1', type: 'payment.status.updated.v1' },
      payload: { currency: 'USD', amountCents: 10000, direction: 'IN' }
    });

    const pos = await app.getPositionByCurrency('USD');
    assert.equal(pos?.availableCash, 10000n);
  });

  await t.test('payment OUT reduces available liquidity', async () => {
    await app.processFinancialEvent({
      metadata: { eventId: 'evt-2', type: 'payment.status.updated.v1' },
      payload: { currency: 'USD', amountCents: 4000, direction: 'OUT' }
    });

    const pos = await app.getPositionByCurrency('USD');
    assert.equal(pos?.availableCash, 6000n);
  });

  await t.test('loan disbursement reduces liquidity', async () => {
    await app.processFinancialEvent({
      metadata: { eventId: 'evt-3', type: 'loan.disbursement.initiated.v1' },
      payload: { currency: 'USD', amountCents: 2000 }
    });

    const pos = await app.getPositionByCurrency('USD');
    assert.equal(pos?.availableCash, 4000n);
  });

  await t.test('duplicate event is skipped (idempotency)', async () => {
    await app.processFinancialEvent({
      metadata: { eventId: 'evt-3', type: 'loan.disbursement.initiated.v1' },
      payload: { currency: 'USD', amountCents: 2000 }
    });

    const pos = await app.getPositionByCurrency('USD');
    assert.equal(pos?.availableCash, 4000n); // Unchanged
  });

  await t.test('multi-currency positions are isolated', async () => {
    await app.processFinancialEvent({
      metadata: { eventId: 'evt-4', type: 'payment.status.updated.v1' },
      payload: { currency: 'EUR', amountCents: 5000, direction: 'IN' }
    });

    const usd = await app.getPositionByCurrency('USD');
    const eur = await app.getPositionByCurrency('EUR');
    
    assert.equal(usd?.availableCash, 4000n);
    assert.equal(eur?.availableCash, 5000n);
  });
});
