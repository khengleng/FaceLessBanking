export class CustomerAccountCreationMetrics {
  public accountsCreatedFromCustomerEvents = 0;

  public duplicateAccountCreationEventsSkipped = 0;

  public existingAccountSkips = 0;

  recordAccountCreatedFromCustomerEvent(): void {
    this.accountsCreatedFromCustomerEvents += 1;
  }

  recordDuplicateAccountCreationEventSkipped(): void {
    this.duplicateAccountCreationEventsSkipped += 1;
  }

  recordExistingAccountSkip(): void {
    this.existingAccountSkips += 1;
  }
}

export class AccountOpsQueryMetrics {
  public listQueries = 0;

  public detailQueries = 0;

  public filteredQueryUsage = 0;

  recordListQuery(): void {
    this.listQueries += 1;
  }

  recordDetailQuery(): void {
    this.detailQueries += 1;
  }

  recordFilteredQueryUsage(): void {
    this.filteredQueryUsage += 1;
  }
}

export class AccountActivationMetrics {
  public accountsActivated = 0;

  public duplicateActivationsSkipped = 0;

  public invalidActivationAttemptsBlocked = 0;

  recordAccountActivated(): void {
    this.accountsActivated += 1;
  }

  recordDuplicateActivationSkipped(): void {
    this.duplicateActivationsSkipped += 1;
  }

  recordInvalidActivationAttemptBlocked(): void {
    this.invalidActivationAttemptsBlocked += 1;
  }
}
