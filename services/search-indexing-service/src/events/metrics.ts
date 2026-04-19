export class SearchIndexingMetrics {
  public indexRecordsUpserted = 0;

  public duplicateIndexEventsSkipped = 0;

  public searchQueriesExecuted = 0;

  recordIndexRecordUpserted(): void {
    this.indexRecordsUpserted += 1;
  }

  recordDuplicateIndexEventSkipped(): void {
    this.duplicateIndexEventsSkipped += 1;
  }

  recordSearchQueryExecuted(): void {
    this.searchQueriesExecuted += 1;
  }
}
