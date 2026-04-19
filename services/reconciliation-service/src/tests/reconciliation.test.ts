import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { PostgresReconciliationAdapter } from '../adapters/postgres-reconciliation.adapter.js';
import { ReconciliationApplication } from '../application/reconciliation.application.js';
import type { ReconciliationMismatch } from '../domain/reconciliation-job.js';
import type { ReconciliationEventsPublisher } from '../events/reconciliation-publisher.adapter.js';

type PublisherCalls = {
  started: number;
  completed: number;
  mismatchDetected: number;
};

type FakePublisher = {
  emitJobStarted: (job: { jobId: string }, correlationId?: string) => Promise<void>;
  emitJobCompleted: (job: { jobId: string }, mismatchCount: number, correlationId?: string) => Promise<void>;
  emitMismatchDetected: (mismatch: { mismatchId: string }, correlationId?: string) => Promise<void>;
};

function buildHarness() {
  const postgresAdapter = new PostgresReconciliationAdapter();
  const publisherCalls: PublisherCalls = {
    started: 0,
    completed: 0,
    mismatchDetected: 0
  };

  const eventPublisher: FakePublisher = {
    async emitJobStarted(_job, _correlationId) {
      void _job;
      void _correlationId;
      publisherCalls.started += 1;
    },
    async emitJobCompleted(_job, _mismatchCount, _correlationId) {
      void _job;
      void _mismatchCount;
      void _correlationId;
      publisherCalls.completed += 1;
    },
    async emitMismatchDetected(_mismatch, _correlationId) {
      void _mismatch;
      void _correlationId;
      publisherCalls.mismatchDetected += 1;
    }
  };

  const logger = {
    info: (_payload: Record<string, unknown>, _message: string) => {
      void _payload;
      void _message;
    },
    warn: (_payload: Record<string, unknown>, _message: string) => {
      void _payload;
      void _message;
    },
    error: (_payload: Record<string, unknown>, _message: string) => {
      void _payload;
      void _message;
    }
  };

  const application = new ReconciliationApplication(
    postgresAdapter,
    eventPublisher as unknown as ReconciliationEventsPublisher,
    logger
  );

  return { application, postgresAdapter, publisherCalls };
}

test('should create a reconciliation job', async () => {
  const harness = buildHarness();

  const job = await harness.application.createJob('PAYMENT_STATUS_RECON');
  assert.ok(job.jobId.length > 0);
  assert.equal(job.status, 'PENDING');
  assert.equal(job.jobType, 'PAYMENT_STATUS_RECON');

  const retrieved = await harness.postgresAdapter.getReconciliationJob(job.jobId);
  assert.deepEqual(retrieved, job);
});

test('should run a job and update status to COMPLETED', async () => {
  const harness = buildHarness();
  const job = await harness.application.createJob('PAYMENT_STATUS_RECON');

  await harness.application.runJob(job.jobId);
  await new Promise((resolve) => setTimeout(resolve, 50));

  const updated = await harness.postgresAdapter.getReconciliationJob(job.jobId);
  assert.equal(updated?.status, 'COMPLETED');
  assert.equal(harness.publisherCalls.started, 1);
  assert.equal(harness.publisherCalls.completed, 1);
});

test('should handle mismatches during reconciliation', async () => {
  const harness = buildHarness();
  const job = await harness.application.createJob('PAYMENT_STATUS_RECON');

  const mismatch: ReconciliationMismatch = {
    mismatchId: randomUUID(),
    jobId: job.jobId,
    entityType: 'payment',
    entityId: 'pay-123',
    expectedValue: 'COMPLETED',
    actualValue: 'FAILED',
    mismatchType: 'DATA_MISMATCH',
    createdAt: new Date().toISOString()
  };

  const appWithHook = harness.application as unknown as {
    handlePaymentRecon: (jobId: string) => Promise<ReconciliationMismatch[]>;
  };
  appWithHook.handlePaymentRecon = async () => [mismatch];

  await harness.application.runJob(job.jobId);
  await new Promise((resolve) => setTimeout(resolve, 50));

  const details = await harness.application.getJobDetails(job.jobId);
  assert.equal(details?.mismatchCount, 1);
  assert.equal(details?.mismatches[0]?.entityId, 'pay-123');
  assert.equal(harness.publisherCalls.mismatchDetected, 1);
});

test('should prevent duplicate runs for the same job ID', async () => {
  const harness = buildHarness();
  const job = await harness.application.createJob('PAYMENT_STATUS_RECON');

  await harness.application.runJob(job.jobId);
  await assert.rejects(() => harness.application.runJob(job.jobId), /Job already running/);
});

test('should mark job as FAILED if execution fails', async () => {
  const harness = buildHarness();
  const job = await harness.application.createJob('PAYMENT_STATUS_RECON');

  const appWithHook = harness.application as unknown as {
    handlePaymentRecon: (jobId: string) => Promise<ReconciliationMismatch[]>;
  };
  appWithHook.handlePaymentRecon = async () => {
    throw new Error('Source Unreachable');
  };

  await harness.application.runJob(job.jobId);
  await new Promise((resolve) => setTimeout(resolve, 50));

  const updated = await harness.postgresAdapter.getReconciliationJob(job.jobId);
  assert.equal(updated?.status, 'FAILED');
  assert.equal(updated?.errorMessage, 'Source Unreachable');
});
