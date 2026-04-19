import { test, describe } from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { AccountingApplication } from '../application/accounting.application.js';
import type { PostgresAccountingAdapter } from '../adapters/postgres-accounting.adapter.js';
import type { AccountingEventsPublisher } from '../events/accounting.events.js';

type PostgresAdapterPort = Pick<
  PostgresAccountingAdapter,
  | 'createJournalEntry'
  | 'createJournalLines'
  | 'getJournalById'
  | 'getJournalLines'
  | 'hasProcessedAccountingEvent'
  | 'markAccountingEventProcessed'
>;

type EventsPublisherPort = Pick<AccountingEventsPublisher, 'emitJournalPosted'>;

// Mocks
const mockPostgresAdapter = {
  createJournalEntry: async () => {},
  createJournalLines: async () => {},
  getJournalById: async () => null,
  getJournalLines: async () => [],
  hasProcessedAccountingEvent: async () => false,
  markAccountingEventProcessed: async () => {}
} satisfies PostgresAdapterPort;

const mockEventsPublisher = {
  emitJournalPosted: async () => {}
} satisfies EventsPublisherPort;

const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {}
};

const app = new AccountingApplication(mockPostgresAdapter, mockEventsPublisher, mockLogger);

describe('AccountingApplication', () => {
  test('manual journal creation enforces balanced entries', async () => {
    const result = await app.createManualJournal({
      description: 'Test unbalanced',
      lines: [
        { accountCode: '1100', entryType: 'DEBIT', amount: 100, currency: 'USD' },
        { accountCode: '2100', entryType: 'CREDIT', amount: 50, currency: 'USD' }
      ]
    });

    assert.strictEqual(result.kind, 'unbalanced');
  });

  test('manual journal creation succeeds for balanced entries', async () => {
    const result = await app.createManualJournal({
      description: 'Test balanced',
      lines: [
        { accountCode: '1100', entryType: 'DEBIT', amount: 100, currency: 'USD' },
        { accountCode: '2100', entryType: 'CREDIT', amount: 100, currency: 'USD' }
      ]
    });

    assert.strictEqual(result.kind, 'created');
    if (result.kind === 'created') {
      assert.strictEqual(result.journal.entry.totalDebit, 100);
      assert.strictEqual(result.journal.entry.totalCredit, 100);
      assert.strictEqual(result.journal.lines.length, 2);
    }
  });

  test('payment completion event creates balanced journal', async () => {
    const event = {
      metadata: { eventId: randomUUID(), correlationId: randomUUID() },
      payload: { paymentId: 'pay-123', amount: 500, currency: 'USD', status: 'COMPLETED' }
    };

    const result = await app.processPaymentCompleted(event);

    assert.strictEqual(result.kind, 'created');
    if (result.kind === 'created') {
      assert.strictEqual(result.journal.entry.totalDebit, 500);
      assert.strictEqual(result.journal.entry.sourceEventType, 'payment.status.updated.v1');
      assert.strictEqual(result.journal.lines[0].accountCode, '1100'); // Cash
      assert.strictEqual(result.journal.lines[1].accountCode, '2100'); // Liability
    }
  });

  test('loan disbursement event creates balanced journal', async () => {
    const event = {
      metadata: { eventId: randomUUID(), correlationId: randomUUID() },
      payload: { loanAccountId: 'loan-123', amount: 100000, currency: 'USD' }
    };

    const result = await app.processLoanDisbursement(event);

    assert.strictEqual(result.kind, 'created');
    if (result.kind === 'created') {
      assert.strictEqual(result.journal.entry.totalDebit, 100000);
      assert.strictEqual(result.journal.lines[0].accountCode, '1200'); // Receivable
      assert.strictEqual(result.journal.lines[1].accountCode, '1100'); // Cash
    }
  });

  test('loan interest accrual event creates balanced journal', async () => {
    const event = {
      metadata: { eventId: randomUUID(), correlationId: randomUUID() },
      payload: { loanAccountId: 'loan-123', accruedInterest: 1500, currency: 'USD' }
    };

    const result = await app.processLoanInterestAccrual(event);

    assert.strictEqual(result.kind, 'created');
    if (result.kind === 'created') {
      assert.strictEqual(result.journal.entry.totalDebit, 1500);
      assert.strictEqual(result.journal.lines[0].accountCode, '1200'); // Receivable
      assert.strictEqual(result.journal.lines[1].accountCode, '4100'); // Income
    }
  });

  test('duplicate source event is skipped', async () => {
    const eventId = randomUUID();
    const event = {
      metadata: { eventId, correlationId: randomUUID() },
      payload: { paymentId: 'pay-123', amount: 500, currency: 'USD', status: 'COMPLETED' }
    };

    const processedMockApp = new AccountingApplication(
      { ...mockPostgresAdapter, hasProcessedAccountingEvent: async () => true },
      mockEventsPublisher,
      mockLogger
    );

    const result = await processedMockApp.processPaymentCompleted(event);
    assert.strictEqual(result.kind, 'duplicate_event');
  });

  test('invalid event (not completed) is handled safely', async () => {
    const event = {
      metadata: { eventId: randomUUID(), correlationId: randomUUID() },
      payload: { paymentId: 'pay-123', amount: 500, currency: 'USD', status: 'PENDING' }
    };

    const result = await app.processPaymentCompleted(event);
    assert.strictEqual(result.kind, 'invalid_event');
  });
});
