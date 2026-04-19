export class OnboardingWorkflowMetrics {
  public onboardingCasesCreated = 0;

  public onboardingCasesTransitioned = 0;

  public duplicateWorkflowEventsSkipped = 0;

  public invalidTransitionsBlocked = 0;

  recordOnboardingCaseCreated(): void {
    this.onboardingCasesCreated += 1;
  }

  recordOnboardingCaseTransitioned(): void {
    this.onboardingCasesTransitioned += 1;
  }

  recordDuplicateWorkflowEventSkipped(): void {
    this.duplicateWorkflowEventsSkipped += 1;
  }

  recordInvalidTransitionBlocked(): void {
    this.invalidTransitionsBlocked += 1;
  }
}

export class ManualReviewQueueMetrics {
  public onboardingQueueListRequests = 0;

  public onboardingActionsApplied = 0;

  public onboardingActionNoops = 0;

  public onboardingInvalidTransitionsBlocked = 0;

  recordQueueListRequest(): void {
    this.onboardingQueueListRequests += 1;
  }

  recordActionApplied(): void {
    this.onboardingActionsApplied += 1;
  }

  recordActionNoop(): void {
    this.onboardingActionNoops += 1;
  }

  recordInvalidTransitionBlocked(): void {
    this.onboardingInvalidTransitionsBlocked += 1;
  }
}
