import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';

test('data extracted correctly for BI target', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'GET',
    url: '/pipeline/export?target=bi&dataset=loans'
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as {
    success: boolean;
    data: {
      target: string;
      dataset: string;
      rows: Array<Record<string, unknown>>;
    };
  };

  assert.equal(body.success, true);
  assert.equal(body.data.target, 'bi');
  assert.equal(body.data.dataset, 'loans');
  assert.equal(body.data.rows.length, 2);
  assert.equal(body.data.rows[0]?.dataset, 'loans');
  assert.equal(body.data.rows[0]?.loanId, 'loan-001');

  await app.close();
});

test('export job tracked', async () => {
  const app = createApp();

  const create = await app.inject({
    method: 'POST',
    url: '/pipeline/export-jobs',
    payload: {
      target: 'dashboard',
      dataset: 'profitability',
      sinkType: 'data-warehouse'
    }
  });

  assert.equal(create.statusCode, 201);
  const created = create.json() as {
    success: boolean;
    data: {
      job: {
        jobId: string;
        dataset: string;
        status: string;
        sinkType: string;
      };
      export: {
        rows: Array<Record<string, unknown>>;
      };
    };
  };

  assert.equal(created.success, true);
  assert.equal(created.data.job.dataset, 'profitability');
  assert.equal(created.data.job.status, 'COMPLETED');
  assert.equal(created.data.job.sinkType, 'data-warehouse');
  assert.equal(created.data.export.rows.length, 2);

  const get = await app.inject({
    method: 'GET',
    url: `/pipeline/export-jobs/${created.data.job.jobId}`
  });

  assert.equal(get.statusCode, 200);
  const found = get.json() as {
    success: boolean;
    data: {
      jobId: string;
      status: string;
      rowCount: number;
      sinkReference: string;
    };
  };
  assert.equal(found.success, true);
  assert.equal(found.data.jobId, created.data.job.jobId);
  assert.equal(found.data.status, 'COMPLETED');
  assert.equal(found.data.rowCount, 2);
  assert.equal(typeof found.data.sinkReference, 'string');

  await app.close();
});

test('invalid extraction request is rejected safely', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/pipeline/export-jobs',
    payload: {
      target: 'warehouse',
      dataset: 'payments'
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().success, false);
  assert.equal(response.json().error, 'validation_failed');

  await app.close();
});
