import { test, describe } from 'node:test';
import assert from 'node:assert';
import { DailyCloseApplication } from '../application/daily-close.application.js';
import type { InternalJobsAdapter } from '../adapters/internal-jobs.adapter.js';
import type { PostgresBatchAdapter } from '../adapters/postgres-batch.adapter.js';
import type { BatchEventsPublisher } from '../events/batch-publisher.adapter.js';

type PostgresBatchPort = Pick<
  PostgresBatchAdapter,
  | 'getRunByBusinessDate'
  | 'createRun'
  | 'updateRunStatus'
  | 'createJobExecution'
  | 'updateJobExecutionStatus'
  | 'getRunWithJobs'
>;

type InternalJobsPort = Pick<
  InternalJobsAdapter,
  | 'runLoanInterestAccrual'
  | 'runDepositInterestAccrual'
  | 'runDelinquencyScan'
  | 'runAccountingClosePlaceholder'
>;

type BatchEventsPort = Pick<
  BatchEventsPublisher,
  'emitDailyCloseStarted' | 'emitDailyCloseCompleted'
>;

// Mocks
const mockPostgresAdapter = {
  getRunByBusinessDate: async () => null,
  createRun: async () => {},
  updateRunStatus: async () => {},
  createJobExecution: async () => {},
  updateJobExecutionStatus: async () => {},
  getRunWithJobs: async () => null
} satisfies PostgresBatchPort;

const mockJobsAdapter = {
  runLoanInterestAccrual: async () => {},
  runDepositInterestAccrual: async () => {},
  runDelinquencyScan: async () => {},
  runAccountingClosePlaceholder: async () => {}
} satisfies InternalJobsPort;

const mockBatchPublisher = {
  emitDailyCloseStarted: async () => {},
  emitDailyCloseCompleted: async () => {}
} satisfies BatchEventsPort;

const mockLogger = {
  info: () => {},
  error: () => {}
};

describe('DailyCloseApplication Orchestration', () => {
  test('daily close run creates records and starts orchestration', async () => {
    let createdRun = false;
    let startedEmitted = false;
    
    const adapter = {
      ...mockPostgresAdapter,
      createRun: async () => { createdRun = true; }
    };
    
    const publisher = {
      ...mockBatchPublisher,
      emitDailyCloseStarted: async () => { startedEmitted = true; }
    };

    const app = new DailyCloseApplication(
      adapter as unknown as PostgresBatchAdapter,
      mockJobsAdapter as unknown as InternalJobsAdapter,
      publisher as unknown as BatchEventsPublisher,
      mockLogger
    );
    const result = await app.runDailyClose('2026-04-15');

    assert.strictEqual(result.kind, 'started');
    assert.ok(result.runId);
    assert.strictEqual(createdRun, true);
    assert.strictEqual(startedEmitted, true);
  });

  test('duplicate run request for same businessDate is handled safely', async () => {
    const adapter = {
      ...mockPostgresAdapter,
      getRunByBusinessDate: async () => ({
        runId: 'existing-run-1',
        businessDate: '2026-04-15',
        status: 'RUNNING'
      })
    };

    const app = new DailyCloseApplication(
      adapter as unknown as PostgresBatchAdapter,
      mockJobsAdapter as unknown as InternalJobsAdapter,
      mockBatchPublisher as unknown as BatchEventsPublisher,
      mockLogger
    );
    const result = await app.runDailyClose('2026-04-15');

    assert.strictEqual(result.kind, 'already_running');
    assert.strictEqual(result.runId, 'existing-run-1');
  });

  test('failing job marks run failed and stops sequence', async () => {
    let job1Started = false;
    let job2Started = false;
    let runFailed = false;

    const jobsAdapter = {
      ...mockJobsAdapter,
      runLoanInterestAccrual: async () => { 
        job1Started = true; 
        throw new Error('Explosion'); 
      },
      runDepositInterestAccrual: async () => { 
        job2Started = true; 
      }
    };

    const adapter = {
      ...mockPostgresAdapter,
      updateRunStatus: async (_id: string, status: string) => { 
        if (status === 'FAILED') runFailed = true; 
      }
    };

    const app = new DailyCloseApplication(
      adapter as unknown as PostgresBatchAdapter,
      jobsAdapter as unknown as InternalJobsAdapter,
      mockBatchPublisher as unknown as BatchEventsPublisher,
      mockLogger
    );
    
    // We call the private method directly for the test to ensure we await the orchestration
    // @ts-expect-error - reaching into internals for precise flow testing
    await app.executeJobs({ runId: 'fail-run', businessDate: '2026-04-15', status: 'RUNNING', startedAt: '' });

    assert.strictEqual(job1Started, true);
    assert.strictEqual(job2Started, false); // Sequence should have stopped
    assert.strictEqual(runFailed, true);
  });
});
