import type { SuspenseStoreAdapter } from '../adapters/suspense.adapters.js';
import type { SuspenseEntry } from '../domain/suspense.js';

type Logger = {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
};

export class SuspenseApplication {
  constructor(
    private readonly store: SuspenseStoreAdapter,
    private readonly logger: Logger
  ) {}

  async recordUnmatchedTransaction(input: { amount: number; reason: string }): Promise<SuspenseEntry> {
    const entry = await this.store.createSuspenseEntry(input);
    this.logger.warn({ entryId: entry.entryId, amount: entry.amount, reason: entry.reason }, 'Unmatched transaction moved to suspense');
    return entry;
  }

  async listSuspense(): Promise<SuspenseEntry[]> {
    return this.store.listSuspenseEntries();
  }

  async resolveSuspense(input: {
    entryId: string;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<SuspenseEntry> {
    const existing = await this.store.getIdempotencyResult('suspense-resolve', input.idempotencyKey);
    if (existing) {
      const prior = await this.store.getSuspenseEntryById(existing.entryId);
      if (prior) {
        this.logger.info({ entryId: prior.entryId, correlationId: input.correlationId }, 'Returning idempotent suspense resolve result');
        return prior;
      }
    }

    const current = await this.store.getSuspenseEntryById(input.entryId);
    if (!current) {
      throw new Error('suspense_not_found');
    }

    const resolved = current.status === 'CLEARED'
      ? current
      : await this.store.updateSuspenseStatus(input.entryId, 'CLEARED');

    await this.store.setIdempotencyResult('suspense-resolve', input.idempotencyKey, { entryId: resolved.entryId });

    this.logger.info(
      { entryId: resolved.entryId, status: resolved.status, correlationId: input.correlationId },
      'Suspense entry resolved and cleared'
    );

    return resolved;
  }
}
