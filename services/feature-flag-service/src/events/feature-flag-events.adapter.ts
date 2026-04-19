import type { FeatureFlag } from '../domain/feature-flag.js';

export class FeatureFlagEventsAdapter {
  async emitFeatureFlagUpdated(flag: FeatureFlag): Promise<void> {
    void flag;
    // Placeholder for future feature-flag.updated.v1 event.
  }
}
