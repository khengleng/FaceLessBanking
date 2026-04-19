import { randomUUID } from 'node:crypto';

import type {
  ConfigAuditRecord,
  ConfigEntry,
  ConfigValue,
  RuntimeConfig
} from '../domain/runtime-config.js';

export class InMemoryConfigStoreAdapter {
  private readonly entries = new Map<string, ConfigEntry>();

  private readonly auditRecords: ConfigAuditRecord[] = [];

  private readonly idempotencyKeys = new Set<string>();

  async listEntries(): Promise<ConfigEntry[]> {
    return Array.from(this.entries.values()).map((entry) => structuredClone(entry));
  }

  async getConfig(): Promise<RuntimeConfig> {
    const entries = await this.listEntries();
    return {
      entries,
      updatedAt: entries.length > 0
        ? entries.reduce((latest, entry) => (entry.updatedAt > latest ? entry.updatedAt : latest), entries[0]!.updatedAt)
        : new Date(0).toISOString()
    };
  }

  async getEntryByKey(key: string): Promise<ConfigEntry | null> {
    const entry = this.entries.get(key);
    return entry ? structuredClone(entry) : null;
  }

  async hasProcessedIdempotencyKey(key: string): Promise<boolean> {
    return this.idempotencyKeys.has(key);
  }

  async markIdempotencyKeyProcessed(key: string): Promise<void> {
    this.idempotencyKeys.add(key);
  }

  async upsertEntry(input: {
    key: string;
    value: ConfigValue;
    updatedBy: string;
    reason: string;
  }): Promise<ConfigEntry> {
    const now = new Date().toISOString();
    const existing = this.entries.get(input.key);

    const nextEntry: ConfigEntry = {
      key: input.key,
      value: input.value,
      version: (existing?.version ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      updatedBy: input.updatedBy,
      reason: input.reason
    };

    this.entries.set(input.key, nextEntry);

    this.auditRecords.push({
      auditId: randomUUID(),
      key: input.key,
      oldValue: existing?.value ?? null,
      newValue: input.value,
      oldVersion: existing?.version ?? 0,
      newVersion: nextEntry.version,
      changedAt: now,
      changedBy: input.updatedBy,
      reason: input.reason
    });

    return structuredClone(nextEntry);
  }

  async listAuditRecords(): Promise<ConfigAuditRecord[]> {
    return this.auditRecords.map((record) => structuredClone(record));
  }
}
