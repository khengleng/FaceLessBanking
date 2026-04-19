import assert from 'node:assert/strict';
import test from 'node:test';

import { KafkaRegulatoryAdapter } from '../adapters/kafka-regulatory.adapter.js';
import { PostgresRegulatoryAdapter } from '../adapters/postgres-regulatory.adapter.js';
import { SourceDataAdapter } from '../adapters/source-data.adapter.js';
import { createApp } from '../app.js';
import { RegulatoryReportingMetrics } from '../events/metrics.js';

function buildHarness() {
  const postgresAdapter = new PostgresRegulatoryAdapter();
  const sourceDataAdapter = new SourceDataAdapter();
  const kafkaAdapter = new KafkaRegulatoryAdapter();
  const metrics = new RegulatoryReportingMetrics();

  const app = createApp({
    postgresAdapter,
    sourceDataAdapter,
    kafkaAdapter,
    metrics
  });

  return {
    app,
    postgresAdapter,
    sourceDataAdapter,
    kafkaAdapter,
    metrics
  };
}

test('transaction report generated', async () => {
  const { app } = buildHarness();

  const response = await app.inject({
    method: 'POST',
    url: '/regulatory/generate',
    headers: {
      'idempotency-key': 'reg-tx-1',
      'x-correlation-id': 'corr-reg-tx-1'
    },
    payload: {
      reportType: 'TRANSACTION_REPORT',
      businessDate: '2026-04-17',
      generatedBy: 'ops-user'
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.reportType, 'TRANSACTION_REPORT');
  assert.equal(response.json().data.status, 'GENERATED');
  assert.equal(response.json().data.recordCount, 2);

  await app.close();
});

test('AML report generated', async () => {
  const { app } = buildHarness();

  const response = await app.inject({
    method: 'POST',
    url: '/regulatory/generate',
    headers: {
      'idempotency-key': 'reg-aml-1'
    },
    payload: {
      reportType: 'AML_REPORT',
      dateRangeStart: '2026-04-01T00:00:00.000Z',
      dateRangeEnd: '2026-04-30T23:59:59.999Z',
      generatedBy: 'ops-user'
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.reportType, 'AML_REPORT');
  assert.equal(response.json().data.status, 'GENERATED');
  assert.equal(response.json().data.recordCount, 1);

  await app.close();
});

test('capital report generated', async () => {
  const { app } = buildHarness();

  const response = await app.inject({
    method: 'POST',
    url: '/regulatory/generate',
    headers: {
      'idempotency-key': 'reg-cap-1'
    },
    payload: {
      reportType: 'CAPITAL_REPORT',
      businessDate: '2026-04-17',
      generatedBy: 'ops-user'
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.reportType, 'CAPITAL_REPORT');
  assert.equal(response.json().data.status, 'GENERATED');
  assert.equal(response.json().data.recordCount, 2);

  await app.close();
});

test('invalid report type rejected safely', async () => {
  const { app } = buildHarness();

  const response = await app.inject({
    method: 'POST',
    url: '/regulatory/generate',
    headers: {
      'idempotency-key': 'reg-invalid-1'
    },
    payload: {
      reportType: 'INVALID',
      businessDate: '2026-04-17',
      generatedBy: 'ops-user'
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().success, false);
  assert.equal(response.json().error, 'validation_failed');

  await app.close();
});

test('failed generation marks report FAILED', async () => {
  const { app, sourceDataAdapter } = buildHarness();
  sourceDataAdapter.setFailOnReportType('AML_REPORT');

  const response = await app.inject({
    method: 'POST',
    url: '/regulatory/generate',
    headers: {
      'idempotency-key': 'reg-fail-1'
    },
    payload: {
      reportType: 'AML_REPORT',
      businessDate: '2026-04-17',
      generatedBy: 'ops-user'
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.status, 'FAILED');
  assert.equal(response.json().data.recordCount, 0);

  await app.close();
});

test('generated event emitted', async () => {
  const { app, kafkaAdapter } = buildHarness();

  await app.inject({
    method: 'POST',
    url: '/regulatory/generate',
    headers: {
      'idempotency-key': 'reg-event-1',
      'x-correlation-id': 'corr-reg-event-1'
    },
    payload: {
      reportType: 'TRANSACTION_REPORT',
      businessDate: '2026-04-17',
      generatedBy: 'ops-user'
    }
  });

  assert.equal(kafkaAdapter.publishedEvents.length, 1);
  assert.equal(kafkaAdapter.publishedEvents[0]?.type, 'regulatory.report.generated.v1');
  assert.equal(kafkaAdapter.publishedEvents[0]?.metadata.correlationId, 'corr-reg-event-1');

  await app.close();
});

test('listing endpoint works', async () => {
  const { app } = buildHarness();

  const create = await app.inject({
    method: 'POST',
    url: '/regulatory/generate',
    headers: {
      'idempotency-key': 'reg-list-1'
    },
    payload: {
      reportType: 'CAPITAL_REPORT',
      businessDate: '2026-04-17',
      generatedBy: 'ops-user'
    }
  });

  const reportId = create.json().data.reportId as string;

  const list = await app.inject({
    method: 'GET',
    url: '/regulatory/reports'
  });

  assert.equal(list.statusCode, 200);
  assert.equal(Array.isArray(list.json().data.items), true);
  assert.equal(list.json().data.items.length, 1);

  const byId = await app.inject({
    method: 'GET',
    url: `/regulatory/reports/${reportId}`
  });

  assert.equal(byId.statusCode, 200);
  assert.equal(byId.json().data.reportId, reportId);

  await app.close();
});
