export class InternalJobsAdapter {
  constructor(
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async runLoanInterestAccrual(businessDate: string): Promise<void> {
    this.logger.info({ businessDate }, 'Triggering loan interest accrual job');
    // In a real system, this would be a POST call or a Kafka Command
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async runDepositInterestAccrual(businessDate: string): Promise<void> {
    this.logger.info({ businessDate }, 'Triggering deposit interest accrual job');
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async runDelinquencyScan(businessDate: string): Promise<void> {
    this.logger.info({ businessDate }, 'Triggering delinquency scan job');
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async runAccountingClosePlaceholder(businessDate: string): Promise<void> {
    this.logger.info({ businessDate }, 'Triggering accounting close placeholder');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
