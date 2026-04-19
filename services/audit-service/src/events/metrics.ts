export class AuditLifecycleMetrics {
  public auditRecordsCreated = 0;

  public duplicateAuditEventsSkipped = 0;

  public malformedLifecycleEventsRejected = 0;

  recordAuditRecordCreated(): void {
    this.auditRecordsCreated += 1;
  }

  recordDuplicateAuditEventSkipped(): void {
    this.duplicateAuditEventsSkipped += 1;
  }

  recordMalformedLifecycleEventRejected(): void {
    this.malformedLifecycleEventsRejected += 1;
  }
}
