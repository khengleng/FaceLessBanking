import {
  createRunId,
  type AlertAdapter,
  type ReconciliationStoreAdapter,
  type SourceDataAdapter
} from '../adapters/reconciliation.adapters.js';
import type {
  ReconciliationResult,
  ReconciliationRunSummary,
  SystemPairKey
} from '../domain/reconciliation.js';

type Logger = {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
};

const PAIRS: SystemPairKey[] = [
  'ledger_vs_accounting',
  'payments_vs_balances',
  'internal_vs_external'
];

export class ReconciliationApplication {
  constructor(
    private readonly sourceAdapter: SourceDataAdapter,
    private readonly storeAdapter: ReconciliationStoreAdapter,
    private readonly alertAdapter: AlertAdapter,
    private readonly logger: Logger
  ) {}

  async getStatus(): Promise<ReconciliationRunSummary | null> {
    return this.storeAdapter.getLatestRun();
  }

  async runReconciliation(input: {
    idempotencyKey: string;
    correlationId: string;
  }): Promise<ReconciliationRunSummary> {
    const existing = await this.storeAdapter.getIdempotencyResult('reconciliation-run', input.idempotencyKey);
    if (existing && hasRunLookup(this.storeAdapter)) {
      const run = this.storeAdapter.getRunById(existing.runId);
      if (run) {
        this.logger.info({ runId: run.runId }, 'Returning idempotent reconciliation run result');
        return run;
      }
    }

    const results: ReconciliationResult[] = [];

    for (const pair of PAIRS) {
      const snapshot = await this.sourceAdapter.getSnapshot(pair);
      const discrepancyAmount = roundToScale(snapshot.sourceAmount - snapshot.targetAmount, 6);
      const status = discrepancyAmount === 0 ? 'MATCH' : 'MISMATCH';

      const result: ReconciliationResult = {
        sourceSystem: snapshot.sourceSystem,
        targetSystem: snapshot.targetSystem,
        status,
        discrepancyAmount: Math.abs(discrepancyAmount)
      };

      results.push(result);
    }

    const runSummary: ReconciliationRunSummary = {
      runId: createRunId(),
      results,
      hasMismatch: results.some((result) => result.status === 'MISMATCH'),
      createdAt: new Date().toISOString()
    };

    await this.storeAdapter.saveRun(runSummary);
    await this.storeAdapter.setIdempotencyResult('reconciliation-run', input.idempotencyKey, { runId: runSummary.runId });

    for (const result of results) {
      if (result.status === 'MISMATCH') {
        this.logger.warn({ runId: runSummary.runId, result, correlationId: input.correlationId }, 'Discrepancy detected');
        await this.alertAdapter.triggerDiscrepancyAlert({ runId: runSummary.runId, result });
      }
    }

    this.logger.info(
      {
        runId: runSummary.runId,
        hasMismatch: runSummary.hasMismatch,
        resultCount: runSummary.results.length,
        correlationId: input.correlationId
      },
      'Cross-system reconciliation run completed'
    );

    return runSummary;
  }
}

function roundToScale(value: number, scale: number): number {
  const factor = 10 ** scale;
  return Math.round(value * factor) / factor;
}

function hasRunLookup(
  adapter: ReconciliationStoreAdapter
): adapter is ReconciliationStoreAdapter & { getRunById(runId: string): ReconciliationRunSummary | null } {
  return 'getRunById' in adapter && typeof adapter.getRunById === 'function';
}
