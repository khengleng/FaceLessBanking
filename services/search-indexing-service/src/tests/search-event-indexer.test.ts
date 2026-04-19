import assert from 'node:assert/strict';
import test from 'node:test';

import { PostgresSearchIndexAdapter } from '../adapters/postgres-search-index.adapter.js';
import { SearchEventIndexerApplication } from '../application/search-event-indexer.application.js';
import type { InvestigationIndexRecord } from '../domain/investigation-index-record.js';
import { SearchIndexingMetrics } from '../events/metrics.js';

function createMockDb(initialRecords: InvestigationIndexRecord[] = []) {
  const records = new Map<string, InvestigationIndexRecord>();
  const processedEvents = new Set<string>();

  for (const record of initialRecords) {
    records.set(`${record.entityType}:${record.entityId}`, record);
  }

  return {
    records,
    processedEvents,
    query: async (text: string, params: unknown[] = []) => {
      if (text.includes('FROM investigation_index_events')) {
        const eventId = String(params[0]);
        return { rowCount: processedEvents.has(eventId) ? 1 : 0, rows: [] };
      }

      if (text.includes('INSERT INTO investigation_index_events')) {
        processedEvents.add(String(params[0]));
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('INSERT INTO investigation_index')) {
        const record: InvestigationIndexRecord = {
          indexId: String(params[0]),
          entityType: String(params[1]) as InvestigationIndexRecord['entityType'],
          entityId: String(params[2]),
          correlationId: params[3] ? String(params[3]) : undefined,
          customerId: params[4] ? String(params[4]) : undefined,
          accountId: params[5] ? String(params[5]) : undefined,
          paymentId: params[6] ? String(params[6]) : undefined,
          caseId: params[7] ? String(params[7]) : undefined,
          status: params[8] ? String(params[8]) : undefined,
          searchableText: String(params[9]),
          sourceEventId: String(params[10]),
          createdAt: String(params[11]),
          updatedAt: String(params[12])
        };
        records.set(`${record.entityType}:${record.entityId}`, record);
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('FROM investigation_index') && text.includes('WHERE entity_type = $1')) {
        const key = `${String(params[0])}:${String(params[1])}`;
        const record = records.get(key);
        if (!record) {
          return { rowCount: 0, rows: [] };
        }

        return {
          rowCount: 1,
          rows: [
            {
              index_id: record.indexId,
              entity_type: record.entityType,
              entity_id: record.entityId,
              correlation_id: record.correlationId,
              customer_id: record.customerId,
              account_id: record.accountId,
              payment_id: record.paymentId,
              case_id: record.caseId,
              status: record.status,
              searchable_text: record.searchableText,
              source_event_id: record.sourceEventId,
              created_at: record.createdAt,
              updated_at: record.updatedAt
            }
          ]
        };
      }

      return { rowCount: 0, rows: [] };
    }
  };
}

function buildIndexer(initialRecords: InvestigationIndexRecord[] = []) {
  const db = createMockDb(initialRecords);
  const adapter = new PostgresSearchIndexAdapter(db);
  const metrics = new SearchIndexingMetrics();

  const indexer = new SearchEventIndexerApplication(adapter, metrics, {
    info: (payload: Record<string, unknown>, message: string): void => {
      void payload;
      void message;
    },
    warn: (payload: Record<string, unknown>, message: string): void => {
      void payload;
      void message;
    },
    error: (payload: Record<string, unknown>, message: string): void => {
      void payload;
      void message;
    }
  });

  return { indexer, db, metrics };
}

function buildEvent(input: {
  type: string;
  eventId: string;
  correlationId?: string;
  payload: Record<string, unknown>;
}) {
  return {
    specVersion: '1.0',
    type: input.type,
    version: 1,
    metadata: {
      eventId: input.eventId,
      correlationId: input.correlationId ?? 'corr-indexing',
      timestamp: new Date().toISOString(),
      producer: 'test-producer'
    },
    payload: input.payload
  };
}

test('selected lifecycle events create/update index records', async () => {
  const harness = buildIndexer();

  const customerResult = await harness.indexer.processLifecycleEvent(buildEvent({
    type: 'customer.created.v1',
    eventId: 'evt-customer-1',
    payload: {
      customerId: 'cust-1',
      status: 'ACTIVE'
    }
  }));

  assert.equal(customerResult.kind, 'indexed');

  const paymentResult = await harness.indexer.processLifecycleEvent(buildEvent({
    type: 'payment.status.updated.v1',
    eventId: 'evt-payment-1',
    payload: {
      paymentId: 'pay-1',
      sourceAccountId: 'acc-1',
      destinationAccountId: 'acc-2',
      amount: 10,
      currency: 'USD',
      status: 'COMPLETED'
    }
  }));

  assert.equal(paymentResult.kind, 'indexed');

  assert.ok(harness.db.records.get('CUSTOMER:cust-1'));
  const paymentRecord = harness.db.records.get('PAYMENT:pay-1');
  assert.ok(paymentRecord);
  assert.equal(paymentRecord?.status, 'COMPLETED');
  assert.equal(harness.metrics.indexRecordsUpserted, 2);
});

test('duplicate source event does not create duplicate index changes unsafely', async () => {
  const harness = buildIndexer();

  const event = buildEvent({
    type: 'account.created.v1',
    eventId: 'evt-account-dup',
    payload: {
      accountId: 'acc-dup',
      customerId: 'cust-dup'
    }
  });

  const first = await harness.indexer.processLifecycleEvent(event);
  assert.equal(first.kind, 'indexed');

  const second = await harness.indexer.processLifecycleEvent(event);
  assert.equal(second.kind, 'duplicate_event');
  assert.equal(harness.metrics.duplicateIndexEventsSkipped, 1);
  assert.equal(harness.db.records.size, 1);
});

test('malformed event is handled safely', async () => {
  const harness = buildIndexer();

  const result = await harness.indexer.processLifecycleEvent({
    specVersion: '1.0',
    type: 'payment.initiated.v1',
    version: 1,
    metadata: {
      eventId: 'evt-bad',
      correlationId: 'corr-bad',
      timestamp: new Date().toISOString(),
      producer: 'payment-service'
    },
    payload: 'invalid'
  });

  assert.equal(result.kind, 'invalid_event');
  assert.equal(harness.db.records.size, 0);
});

test('unsafe fields are not indexed', async () => {
  const harness = buildIndexer();

  const result = await harness.indexer.processLifecycleEvent(buildEvent({
    type: 'customer.profile.enriched.v1',
    eventId: 'evt-profile-unsafe',
    payload: {
      customerId: 'cust-safe-1',
      verificationStatus: 'APPROVED',
      token: 'secret-token-1',
      rawDocument: 'sensitive-doc',
      password: 'sensitive-password'
    }
  }));

  assert.equal(result.kind, 'indexed');

  const record = harness.db.records.get('CUSTOMER:cust-safe-1');
  assert.ok(record);
  assert.equal(record?.searchableText.includes('secret-token-1'), false);
  assert.equal(record?.searchableText.includes('sensitive-doc'), false);
  assert.equal(record?.searchableText.includes('sensitive-password'), false);
});
