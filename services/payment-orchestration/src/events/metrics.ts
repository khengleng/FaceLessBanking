export class PaymentMetrics {
  public paymentAcceptedCount = 0;
  public idempotencyHitCount = 0;
  public kafkaPublishSuccessCount = 0;
  public kafkaPublishFailureCount = 0;

  public paymentsProcessingStarted = 0;
  public paymentsCompleted = 0;
  public paymentsFailed = 0;
  public duplicateConsumerEventsSkipped = 0;

  public listQueries = 0;

  public detailQueries = 0;

  public filteredQueryUsage = 0;

  recordPaymentAccepted(): void {
    this.paymentAcceptedCount += 1;
  }

  recordIdempotencyHit(): void {
    this.idempotencyHitCount += 1;
  }

  recordKafkaPublishSuccess(): void {
    this.kafkaPublishSuccessCount += 1;
  }

  recordKafkaPublishFailure(): void {
    this.kafkaPublishFailureCount += 1;
  }

  recordPaymentsProcessingStarted(): void {
    this.paymentsProcessingStarted += 1;
  }

  recordPaymentsCompleted(): void {
    this.paymentsCompleted += 1;
  }

  recordPaymentsFailed(): void {
    this.paymentsFailed += 1;
  }

  recordDuplicateConsumerEventSkipped(): void {
    this.duplicateConsumerEventsSkipped += 1;
  }

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
