import type { RuntimeConfig } from '../domain/runtime-config.js';

export class ConfigEventsAdapter {
  async emitConfigUpdated(config: RuntimeConfig): Promise<void> {
    void config;
    // Placeholder for future config.updated.v1 event emission.
  }
}
