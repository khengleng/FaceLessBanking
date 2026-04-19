import type { LoanDelinquencyApplication } from '../application/loan-delinquency.application.js';

export class LoanDelinquencyScheduler {
  constructor(private readonly application: LoanDelinquencyApplication) {}

  async runOnce(correlationId: string): Promise<void> {
    await this.application.runDetection(correlationId);
  }
}
