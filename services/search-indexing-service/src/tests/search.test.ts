import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';
import type { InvestigationIndexRecord } from '../domain/investigation-index-record.js';

const OPS_HEADERS = {
  'x-internal-ops-role': 'ops',
  'x-internal-ops-actor-id': 'ops-user-777'
};

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
          rows: [toRow(record)]
        };
      }

      if (text.includes('FROM investigation_index') && text.includes('LIMIT $9 OFFSET $10')) {
        const q = params[0] ? String(params[0]).toLowerCase() : undefined;
        const entityType = params[1] ? String(params[1]) : undefined;
        const customerId = params[2] ? String(params[2]) : undefined;
        const accountId = params[3] ? String(params[3]) : undefined;
        const paymentId = params[4] ? String(params[4]) : undefined;
        const caseId = params[5] ? String(params[5]) : undefined;
        const status = params[6] ? String(params[6]) : undefined;
        const correlationId = params[7] ? String(params[7]) : undefined;
        const limit = Number(params[8]);
        const offset = Number(params[9]);

        let list = [...records.values()];

        if (q) {
          list = list.filter((record) => record.searchableText.toLowerCase().includes(q));
        }

        if (entityType) {
          list = list.filter((record) => record.entityType === entityType);
        }

        if (customerId) {
          list = list.filter((record) => record.customerId === customerId);
        }

        if (accountId) {
          list = list.filter((record) => record.accountId === accountId);
        }

        if (paymentId) {
          list = list.filter((record) => record.paymentId === paymentId);
        }

        if (caseId) {
          list = list.filter((record) => record.caseId === caseId);
        }

        if (status) {
          list = list.filter((record) => record.status === status);
        }

        if (correlationId) {
          list = list.filter((record) => record.correlationId === correlationId);
        }

        list.sort((a, b) => a.updatedAt < b.updatedAt ? 1 : -1);

        const rows = list.slice(offset, offset + limit).map((record) => toRow(record));
        return { rowCount: rows.length, rows };
      }

      return { rowCount: 0, rows: [] };
    }
  };
}

function toRow(record: InvestigationIndexRecord): Record<string, unknown> {
  return {
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
  };
}

function seedRecord(overrides: Partial<InvestigationIndexRecord> = {}): InvestigationIndexRecord {
  return {
    indexId: overrides.indexId ?? 'PAYMENT:pay-1',
    entityType: overrides.entityType ?? 'PAYMENT',
    entityId: overrides.entityId ?? 'pay-1',
    correlationId: overrides.correlationId ?? 'corr-search-1',
    customerId: overrides.customerId ?? 'cust-1',
    accountId: overrides.accountId ?? 'acc-1',
    paymentId: overrides.paymentId ?? 'pay-1',
    caseId: overrides.caseId,
    status: overrides.status ?? 'COMPLETED',
    searchableText: overrides.searchableText ?? 'payment pay-1 completed cust-1 acc-1 corr-search-1',
    sourceEventId: overrides.sourceEventId ?? 'evt-search-1',
    createdAt: overrides.createdAt ?? '2026-04-14T08:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-04-14T08:00:00.000Z'
  };
}

test('GET /health returns health payload', async () => {
  const app = createApp({ db: createMockDb() });

  const response = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(response.statusCode, 200);

  const payload = response.json() as { status: string; service: string };
  assert.equal(payload.status, 'ok');
  assert.equal(payload.service, 'search-indexing-service');

  await app.close();
});

test('GET /search requires internal ops auth placeholder', async () => {
  const app = createApp({ db: createMockDb() });

  const response = await app.inject({ method: 'GET', url: '/search' });

  assert.equal(response.statusCode, 403);
  const payload = response.json() as { success: boolean; error: { code: string } };
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'forbidden');

  await app.close();
});

test('GET /search filters by entityType and ids', async () => {
  const app = createApp({
    db: createMockDb([
      seedRecord(),
      seedRecord({
        indexId: 'CUSTOMER:cust-1',
        entityType: 'CUSTOMER',
        entityId: 'cust-1',
        paymentId: undefined,
        searchableText: 'customer cust-1 active'
      }),
      seedRecord({
        indexId: 'PAYMENT:pay-2',
        entityType: 'PAYMENT',
        entityId: 'pay-2',
        paymentId: 'pay-2',
        status: 'PENDING',
        searchableText: 'payment pay-2 pending cust-2 acc-2'
      })
    ])
  });

  const response = await app.inject({
    method: 'GET',
    url: '/search?entityType=PAYMENT&paymentId=pay-1',
    headers: OPS_HEADERS
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as {
    success: boolean;
    data: { items: Array<{ entityType: string; entityId: string }> };
  };

  assert.equal(payload.success, true);
  assert.equal(payload.data.items.length, 1);
  assert.equal(payload.data.items[0]?.entityType, 'PAYMENT');
  assert.equal(payload.data.items[0]?.entityId, 'pay-1');

  await app.close();
});

test('GET /search supports free-text placeholder query safely', async () => {
  const app = createApp({
    db: createMockDb([
      seedRecord({ searchableText: 'payment pay-1 completed approved' }),
      seedRecord({
        indexId: 'PAYMENT:pay-3',
        entityId: 'pay-3',
        paymentId: 'pay-3',
        searchableText: 'payment pay-3 failed'
      })
    ])
  });

  const response = await app.inject({
    method: 'GET',
    url: '/search?q=approved',
    headers: OPS_HEADERS
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as {
    success: boolean;
    data: { items: Array<{ entityId: string }> };
  };

  assert.equal(payload.success, true);
  assert.equal(payload.data.items.length, 1);
  assert.equal(payload.data.items[0]?.entityId, 'pay-1');

  await app.close();
});

test('GET /search/:entityType/:entityId returns detail when found', async () => {
  const app = createApp({
    db: createMockDb([seedRecord()])
  });

  const response = await app.inject({
    method: 'GET',
    url: '/search/PAYMENT/pay-1',
    headers: OPS_HEADERS
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as {
    success: boolean;
    data: { entityType: string; entityId: string };
  };

  assert.equal(payload.success, true);
  assert.equal(payload.data.entityType, 'PAYMENT');
  assert.equal(payload.data.entityId, 'pay-1');

  await app.close();
});

test('unsafe fields are not returned from search results', async () => {
  const app = createApp({
    db: createMockDb([
      seedRecord({
        searchableText: 'payment pay-1 completed',
        sourceEventId: 'evt-safe'
      })
    ])
  });

  const response = await app.inject({
    method: 'GET',
    url: '/search',
    headers: OPS_HEADERS
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as {
    success: boolean;
    data: { items: Array<Record<string, unknown>> };
  };

  assert.equal(payload.success, true);
  const first = payload.data.items[0] ?? {};
  assert.equal('searchableText' in first, false);
  assert.equal('token' in first, false);
  assert.equal('rawDocument' in first, false);

  await app.close();
});
