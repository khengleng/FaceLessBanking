export class AMLMetrics {
  amlEventsEvaluated = 0;

  amlAlertsCreated = 0;

  duplicateAmlEventsSkipped = 0;

  malformedAmlEventsRejected = 0;

  recordEventEvaluated(): void {
    this.amlEventsEvaluated += 1;
  }

  recordAlertCreated(count = 1): void {
    this.amlAlertsCreated += count;
  }

  recordDuplicateEventSkipped(): void {
    this.duplicateAmlEventsSkipped += 1;
  }

  recordMalformedEventRejected(): void {
    this.malformedAmlEventsRejected += 1;
  }
}
