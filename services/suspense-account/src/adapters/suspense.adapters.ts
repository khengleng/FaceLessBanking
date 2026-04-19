import crypto from 'node:crypto';

import type { CreateSuspenseEntryInput, SuspenseEntry, SuspenseStatus } from '../domain/suspense.js';

export interface SuspenseStoreAdapter {
  createSuspenseEntry(input: CreateSuspenseEntryInput): Promise<SuspenseEntry>;
  listSuspenseEntries(): Promise<SuspenseEntry[]>;
  getSuspenseEntryById(entryId: string): Promise<SuspenseEntry | null>;
  updateSuspenseStatus(entryId: string, status: SuspenseStatus): Promise<SuspenseEntry>;
  getIdempotencyResult(scope: string, idempotencyKey: string): Promise<{ entryId: string } | null>;
  setIdempotencyResult(scope: string, idempotencyKey: string, value: { entryId: string }): Promise<void>;
}

export class InMemorySuspenseStoreAdapter implements SuspenseStoreAdapter {
  private readonly entries = new Map<string, SuspenseEntry>();

  private readonly idempotency = new Map<string, { entryId: string }>();

  async createSuspenseEntry(input: CreateSuspenseEntryInput): Promise<SuspenseEntry> {
    const now = new Date().toISOString();
    const entry: SuspenseEntry = {
      entryId: crypto.randomUUID(),
      amount: input.amount,
      reason: input.reason,
      status: 'SUSPENSE',
      createdAt: now,
      updatedAt: now
    };

    this.entries.set(entry.entryId, entry);
    return entry;
  }

  async listSuspenseEntries(): Promise<SuspenseEntry[]> {
    return [...this.entries.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getSuspenseEntryById(entryId: string): Promise<SuspenseEntry | null> {
    return this.entries.get(entryId) ?? null;
  }

  async updateSuspenseStatus(entryId: string, status: SuspenseStatus): Promise<SuspenseEntry> {
    const existing = this.entries.get(entryId);
    if (!existing) {
      throw new Error('suspense_not_found');
    }

    const updated: SuspenseEntry = {
      ...existing,
      status,
      updatedAt: new Date().toISOString()
    };

    this.entries.set(entryId, updated);
    return updated;
  }

  async getIdempotencyResult(scope: string, idempotencyKey: string): Promise<{ entryId: string } | null> {
    return this.idempotency.get(`${scope}:${idempotencyKey}`) ?? null;
  }

  async setIdempotencyResult(scope: string, idempotencyKey: string, value: { entryId: string }): Promise<void> {
    this.idempotency.set(`${scope}:${idempotencyKey}`, value);
  }
}
