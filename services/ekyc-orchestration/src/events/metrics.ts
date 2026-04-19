export class EkycWebhookMetrics {
  public webhooksReceived = 0;

  public webhooksValidated = 0;

  public duplicateWebhooksSkipped = 0;

  public ekycStatusUpdatesEmitted = 0;

  recordWebhookReceived(): void {
    this.webhooksReceived += 1;
  }

  recordWebhookValidated(): void {
    this.webhooksValidated += 1;
  }

  recordDuplicateWebhookSkipped(): void {
    this.duplicateWebhooksSkipped += 1;
  }

  recordEkycStatusUpdatedEmitted(): void {
    this.ekycStatusUpdatesEmitted += 1;
  }
}
