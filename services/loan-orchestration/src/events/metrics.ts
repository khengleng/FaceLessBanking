export class LoanDisbursementMetrics {
  public disbursementsTriggered = 0;

  public duplicateDisbursementEventsSkipped = 0;

  public invalidStateTransitionsBlocked = 0;

  recordDisbursementTriggered(): void {
    this.disbursementsTriggered += 1;
  }

  recordDuplicateDisbursementEventSkipped(): void {
    this.duplicateDisbursementEventsSkipped += 1;
  }

  recordInvalidStateTransitionBlocked(): void {
    this.invalidStateTransitionsBlocked += 1;
  }
}

export class LoanDelinquencyMetrics {
  public delinquentLoansMarked = 0;

  public duplicateDelinquencySkipped = 0;

  public emptyOverdueDatasetRuns = 0;

  recordDelinquentLoanMarked(): void {
    this.delinquentLoansMarked += 1;
  }

  recordDuplicateDelinquencySkipped(): void {
    this.duplicateDelinquencySkipped += 1;
  }

  recordEmptyOverdueDatasetRun(): void {
    this.emptyOverdueDatasetRuns += 1;
  }
}

export class LoanScheduleMetrics {
  public schedulesGenerated = 0;

  public duplicateScheduleGenerationsSkipped = 0;

  public scheduleGenerationFailures = 0;

  recordScheduleGenerated(): void {
    this.schedulesGenerated += 1;
  }

  recordDuplicateScheduleGenerationSkipped(): void {
    this.duplicateScheduleGenerationsSkipped += 1;
  }

  recordScheduleGenerationFailure(): void {
    this.scheduleGenerationFailures += 1;
  }
}

export class LoanInterestAccrualMetrics {
  public accrualsProcessed = 0;

  public duplicateAccrualsSkipped = 0;

  public accrualFailures = 0;

  public eligibleLoanAccountsScanned = 0;

  recordAccrualProcessed(): void {
    this.accrualsProcessed += 1;
  }

  recordAccrualSkippedDuplicate(): void {
    this.duplicateAccrualsSkipped += 1;
  }

  recordAccrualFailure(): void {
    this.accrualFailures += 1;
  }

  recordEligibleLoanAccountsScanned(count: number): void {
    this.eligibleLoanAccountsScanned += count;
  }
}
