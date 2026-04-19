import type { ReconciliationJobType } from '../domain/reconciliation-job.js';

export type LedgerExpectedState = {
  expectedCount: number;
};

export interface LedgerReconciliationAdapter {
  fetchExpectedState(jobType: ReconciliationJobType): Promise<LedgerExpectedState>;
}

export class LedgerReconciliationAdapterStub implements LedgerReconciliationAdapter {
  async fetchExpectedState(jobType: ReconciliationJobType): Promise<LedgerExpectedState> {
    void jobType;
    return { expectedCount: 11 };
  }
}
