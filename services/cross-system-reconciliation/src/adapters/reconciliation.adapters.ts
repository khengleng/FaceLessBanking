import crypto from 'node:crypto';

import type {
  ReconciliationResult,
  ReconciliationRunSummary,
  SystemComparisonSnapshot,
  SystemPairKey
} from '../domain/reconciliation.js';

export interface SourceDataAdapter {
  getSnapshot(pair: SystemPairKey): Promise<SystemComparisonSnapshot>;
}

export interface ReconciliationStoreAdapter {
  saveRun(summary: ReconciliationRunSummary): Promise<void>;
  getLatestRun(): Promise<ReconciliationRunSummary | null>;
  getIdempotencyResult(scope: string, idempotencyKey: string): Promise<{ runId: string } | null>;
  setIdempotencyResult(scope: string, idempotencyKey: string, value: { runId: string }): Promise<void>;
}

export interface AlertAdapter {
  triggerDiscrepancyAlert(input: { runId: string; result: ReconciliationResult }): Promise<void>;
}

export class InMemorySourceDataAdapter implements SourceDataAdapter {
  private readonly snapshots = new Map<SystemPairKey, SystemComparisonSnapshot>([
    ['ledger_vs_accounting', {
      pair: 'ledger_vs_accounting',
      sourceSystem: 'ledger',
      targetSystem: 'accounting',
      sourceAmount: 1_000,
      targetAmount: 1_000
    }],
    ['payments_vs_balances', {
      pair: 'payments_vs_balances',
      sourceSystem: 'payments',
      targetSystem: 'balances',
      sourceAmount: 500,
      targetAmount: 500
    }],
    ['internal_vs_external', {
      pair: 'internal_vs_external',
      sourceSystem: 'internal',
      targetSystem: 'external',
      sourceAmount: 250,
      targetAmount: 250
    }]
  ]);

  async getSnapshot(pair: SystemPairKey): Promise<SystemComparisonSnapshot> {
    return this.snapshots.get(pair) ?? {
      pair,
      sourceSystem: 'unknown-source',
      targetSystem: 'unknown-target',
      sourceAmount: 0,
      targetAmount: 0
    };
  }

  setSnapshot(snapshot: SystemComparisonSnapshot): void {
    this.snapshots.set(snapshot.pair, snapshot);
  }
}

export class InMemoryReconciliationStoreAdapter implements ReconciliationStoreAdapter {
  private readonly runById = new Map<string, ReconciliationRunSummary>();

  private latestRunId: string | null = null;

  private readonly idempotency = new Map<string, { runId: string }>();

  async saveRun(summary: ReconciliationRunSummary): Promise<void> {
    this.runById.set(summary.runId, summary);
    this.latestRunId = summary.runId;
  }

  async getLatestRun(): Promise<ReconciliationRunSummary | null> {
    if (!this.latestRunId) {
      return null;
    }

    return this.runById.get(this.latestRunId) ?? null;
  }

  async getIdempotencyResult(scope: string, idempotencyKey: string): Promise<{ runId: string } | null> {
    return this.idempotency.get(`${scope}:${idempotencyKey}`) ?? null;
  }

  async setIdempotencyResult(scope: string, idempotencyKey: string, value: { runId: string }): Promise<void> {
    this.idempotency.set(`${scope}:${idempotencyKey}`, value);
  }

  getRunById(runId: string): ReconciliationRunSummary | null {
    return this.runById.get(runId) ?? null;
  }
}

export class InMemoryAlertAdapter implements AlertAdapter {
  readonly alerts: Array<{ runId: string; result: ReconciliationResult }> = [];

  async triggerDiscrepancyAlert(input: { runId: string; result: ReconciliationResult }): Promise<void> {
    this.alerts.push(input);
  }
}

export function createRunId(): string {
  return crypto.randomUUID();
}
