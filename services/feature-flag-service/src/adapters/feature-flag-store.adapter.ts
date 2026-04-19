import type { FeatureFlag } from '../domain/feature-flag.js';

export class FeatureFlagStoreAdapter {
  private readonly flagsByKey = new Map<string, FeatureFlag>();

  private readonly idempotencyKeys = new Set<string>();

  async listFlags(): Promise<FeatureFlag[]> {
    return Array.from(this.flagsByKey.values()).map((flag) => structuredClone(flag));
  }

  async getFlagByKey(flagKey: string): Promise<FeatureFlag | null> {
    const flag = this.flagsByKey.get(flagKey);
    return flag ? structuredClone(flag) : null;
  }

  async upsertFlag(flag: FeatureFlag): Promise<FeatureFlag> {
    this.flagsByKey.set(flag.flagKey, structuredClone(flag));
    return structuredClone(flag);
  }

  async hasProcessedIdempotencyKey(key: string): Promise<boolean> {
    return this.idempotencyKeys.has(key);
  }

  async markIdempotencyKeyProcessed(key: string): Promise<void> {
    this.idempotencyKeys.add(key);
  }
}
