export class OnboardingCustomerCreationMetrics {
  public customersCreatedFromOnboarding = 0;

  public duplicateCustomerCreationEventsSkipped = 0;

  public approvalsIgnoredCustomerAlreadyExists = 0;

  recordCustomerCreatedFromOnboarding(): void {
    this.customersCreatedFromOnboarding += 1;
  }

  recordDuplicateCustomerCreationEventSkipped(): void {
    this.duplicateCustomerCreationEventsSkipped += 1;
  }

  recordApprovalIgnoredCustomerAlreadyExists(): void {
    this.approvalsIgnoredCustomerAlreadyExists += 1;
  }
}

export class CustomerProfileEnrichmentMetrics {
  public profilesEnriched = 0;

  public duplicateProfileEventsSkipped = 0;

  public invalidPatchAttempts = 0;

  recordProfileEnriched(): void {
    this.profilesEnriched += 1;
  }

  recordDuplicateProfileEventSkipped(): void {
    this.duplicateProfileEventsSkipped += 1;
  }

  recordInvalidPatchAttempt(): void {
    this.invalidPatchAttempts += 1;
  }
}

export class CustomerOpsQueryMetrics {
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
