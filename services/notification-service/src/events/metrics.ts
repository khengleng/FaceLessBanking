export class NotificationTriggerMetrics {
  public notificationRequestsCreated = 0;

  public duplicateNotificationsSkipped = 0;

  public notificationEventsPublished = 0;

  public onboardingNotificationsCreated = 0;

  public duplicateOnboardingNotificationsSkipped = 0;

  public onboardingNotificationEventsPublished = 0;

  recordNotificationRequestsCreated(): void {
    this.notificationRequestsCreated += 1;
  }

  recordDuplicateNotificationsSkipped(): void {
    this.duplicateNotificationsSkipped += 1;
  }

  recordNotificationEventsPublished(): void {
    this.notificationEventsPublished += 1;
  }

  recordOnboardingNotificationsCreated(): void {
    this.onboardingNotificationsCreated += 1;
  }

  recordDuplicateOnboardingNotificationsSkipped(): void {
    this.duplicateOnboardingNotificationsSkipped += 1;
  }

  recordOnboardingNotificationEventsPublished(): void {
    this.onboardingNotificationEventsPublished += 1;
  }
}
