import assert from 'node:assert/strict';
import test from 'node:test';

import {
  InMemoryReportDataAdapter,
  InMemoryReportStoreAdapter
} from '../adapters/regulatory-reporting.adapters.js';
import { RegulatoryReportingApplication } from '../application/regulatory-reporting.application.js';

test('report generated', async () => {
  const data = new InMemoryReportDataAdapter();
  const store = new InMemoryReportStoreAdapter();
  const logger = {
    info: (): void => {},
    warn: (): void => {},
    error: (): void => {}
  };

  const app = new RegulatoryReportingApplication(data, store, logger);

  const report = await app.generateReport({
    type: 'AML',
    idempotencyKey: 'idem-report-1',
    correlationId: 'corr-report-1'
  });

  assert.equal(report.type, 'AML');
  assert.ok(report.reportId.length > 0);
  assert.ok(report.generatedAt.length > 0);
});

test('data accuracy validated', async () => {
  const data = new InMemoryReportDataAdapter();
  data.setTransactionSnapshot({ transactionCount: 7, totalAmount: 1750 });

  const store = new InMemoryReportStoreAdapter();
  const logger = {
    info: (): void => {},
    warn: (): void => {},
    error: (): void => {}
  };

  const app = new RegulatoryReportingApplication(data, store, logger);

  const report = await app.generateReport({
    type: 'TRANSACTION',
    idempotencyKey: 'idem-report-2',
    correlationId: 'corr-report-2'
  });

  assert.equal(report.type, 'TRANSACTION');
  assert.equal(report.data.transactionCount, 7);
  assert.equal(report.data.totalAmount, 1750);
  assert.equal(report.data.accurate, true);
});
