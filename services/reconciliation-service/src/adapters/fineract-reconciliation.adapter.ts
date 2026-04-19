import type { ReconciliationJobType } from '../domain/reconciliation-job.js';

export type FineractSourceState = {
  sourceCount: number;
};

export interface FineractReconciliationAdapter {
  fetchSourceState(jobType: ReconciliationJobType): Promise<FineractSourceState>;
}

export class FineractReconciliationAdapterStub implements FineractReconciliationAdapter {
  async fetchSourceState(jobType: ReconciliationJobType): Promise<FineractSourceState> {
    void jobType;
    return { sourceCount: 10 };
  }
}
