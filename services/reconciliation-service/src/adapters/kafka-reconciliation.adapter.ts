import type { ReconciliationJobType } from '../domain/reconciliation-job.js';

export type KafkaExpectedState = {
  expectedCount: number;
};

export interface KafkaReconciliationAdapter {
  fetchExpectedState(jobType: ReconciliationJobType): Promise<KafkaExpectedState>;
}

export class KafkaReconciliationAdapterStub implements KafkaReconciliationAdapter {
  async fetchExpectedState(jobType: ReconciliationJobType): Promise<KafkaExpectedState> {
    void jobType;
    return { expectedCount: 12 };
  }
}
