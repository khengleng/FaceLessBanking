export class BalanceMetrics {
  public cacheHits = 0;

  public cacheMisses = 0;

  public projectionUpdates = 0;

  public duplicateProjectionEventsSkipped = 0;

  public redisCacheRefreshSuccess = 0;

  public redisCacheRefreshFailure = 0;

  public defaultBalanceSnapshotsCreated = 0;

  public duplicateSnapshotInitEventsSkipped = 0;

  recordCacheHit(): void {
    this.cacheHits += 1;
  }

  recordCacheMiss(): void {
    this.cacheMisses += 1;
  }

  recordProjectionUpdate(): void {
    this.projectionUpdates += 1;
  }

  recordProjectionUpdateApplied(): void {
    this.projectionUpdates += 1;
  }

  recordDuplicateProjectionEventSkipped(): void {
    this.duplicateProjectionEventsSkipped += 1;
  }

  recordRedisCacheRefreshSuccess(): void {
    this.redisCacheRefreshSuccess += 1;
  }

  recordRedisCacheRefreshFailure(): void {
    this.redisCacheRefreshFailure += 1;
  }

  recordDefaultBalanceSnapshotCreated(): void {
    this.defaultBalanceSnapshotsCreated += 1;
  }

  recordDuplicateSnapshotInitEventSkipped(): void {
    this.duplicateSnapshotInitEventsSkipped += 1;
  }
}
