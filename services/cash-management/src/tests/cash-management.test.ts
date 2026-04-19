import assert from 'node:assert/strict';
import test from 'node:test';

import {
  InMemoryCashManagementEventAdapter,
  InMemoryCashManagementPostgresAdapter
} from '../adapters/cash-management.adapters.js';
import { CashManagementApplication } from '../application/cash-management.application.js';

function buildHarness() {
  const postgres = new InMemoryCashManagementPostgresAdapter();
  const events = new InMemoryCashManagementEventAdapter();
  const logger = {
    info: (): void => {},
    warn: (): void => {},
    error: (): void => {}
  };

  const application = new CashManagementApplication(postgres, events, logger);

  return { application, events };
}

test('virtual account mapping', async () => {
  const { application, events } = buildHarness();

  const virtualAccount = await application.createVirtualAccount({
    request: {
      corporateId: 'corp-1',
      mappedAccountId: 'acct-main-1',
      currency: 'USD'
    },
    idempotencyKey: 'idem-va-1',
    correlationId: 'corr-va-1'
  });

  assert.equal(virtualAccount.corporateId, 'corp-1');
  assert.equal(virtualAccount.mappedAccountId, 'acct-main-1');
  assert.equal(virtualAccount.currency, 'USD');
  assert.ok(virtualAccount.accountNumber.startsWith('VA-'));

  assert.equal(events.events.length, 1);
  assert.equal(events.events[0]?.type, 'cash.virtual_account.created.v1');
});

test('bulk payment execution', async () => {
  const { application, events } = buildHarness();

  const batch = await application.processBulkPayments({
    request: {
      corporateId: 'corp-1',
      currency: 'USD',
      items: [
        {
          sourceAccountId: 'acct-main-1',
          destinationAccountId: 'acct-vendor-1',
          amount: 100
        },
        {
          sourceAccountId: 'acct-main-1',
          destinationAccountId: 'acct-vendor-2',
          amount: 250
        }
      ]
    },
    idempotencyKey: 'idem-bulk-1',
    correlationId: 'corr-bulk-1'
  });

  assert.equal(batch.status, 'PROCESSED');
  assert.equal(batch.items.length, 2);
  assert.equal(batch.totalAmount, 350);
  assert.equal(batch.items.every((item) => item.status === 'PROCESSED'), true);

  const positions = await application.getPositions('corp-1');
  assert.equal(positions.length, 1);
  assert.equal(positions[0]?.totalProcessedBulkAmount, 350);
  assert.equal(positions[0]?.currency, 'USD');

  const emittedTypes = events.events.map((event) => event.type);
  assert.deepEqual(emittedTypes, ['cash.bulk_payments.processed.v1']);
});
