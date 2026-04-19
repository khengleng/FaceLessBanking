import { createHash } from 'node:crypto';

export type IdempotencyStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export type IdempotencyRecord = {
  scope: string;
  idempotencyKey: string;
  requestHash: string;
  responseHash?: string;
  responseSnapshot?: unknown;
  status: IdempotencyStatus;
  createdAt: string;
  updatedAt: string;
};

export interface IdempotencyStorageAdapter {
  get(scope: string, idempotencyKey: string): Promise<IdempotencyRecord | null>;
  create(record: IdempotencyRecord): Promise<void>;
  update(record: IdempotencyRecord): Promise<void>;
}

export class InMemoryIdempotencyStorageAdapter implements IdempotencyStorageAdapter {
  private readonly records = new Map<string, IdempotencyRecord>();

  async get(scope: string, idempotencyKey: string): Promise<IdempotencyRecord | null> {
    return this.records.get(this.storageKey(scope, idempotencyKey)) ?? null;
  }

  async create(record: IdempotencyRecord): Promise<void> {
    const key = this.storageKey(record.scope, record.idempotencyKey);
    if (this.records.has(key)) {
      throw new Error('idempotency_record_already_exists');
    }

    this.records.set(key, cloneRecord(record));
  }

  async update(record: IdempotencyRecord): Promise<void> {
    this.records.set(this.storageKey(record.scope, record.idempotencyKey), cloneRecord(record));
  }

  private storageKey(scope: string, idempotencyKey: string): string {
    return `${scope}:${idempotencyKey}`;
  }
}

export type IdempotentApiRequestInput<TResult> = {
  scope: string;
  idempotencyKey: string;
  requestIntent: unknown;
  execute: () => Promise<TResult>;
  storage: IdempotencyStorageAdapter;
  now?: () => Date;
};

export type IdempotentApiRequestResult<TResult> =
  | {
      kind: 'executed';
      response: TResult;
      record: IdempotencyRecord;
    }
  | {
      kind: 'replayed';
      response: TResult;
      record: IdempotencyRecord;
    }
  | {
      kind: 'conflicting_duplicate';
      record: IdempotencyRecord;
    }
  | {
      kind: 'in_progress_duplicate';
      record: IdempotencyRecord;
    };

export async function processIdempotentApiRequest<TResult>(
  input: IdempotentApiRequestInput<TResult>
): Promise<IdempotentApiRequestResult<TResult>> {
  const now = input.now ?? (() => new Date());
  const requestHash = hashRequestIntent(input.requestIntent);
  const existing = await input.storage.get(input.scope, input.idempotencyKey);

  if (existing) {
    if (existing.requestHash !== requestHash) {
      return {
        kind: 'conflicting_duplicate',
        record: existing
      };
    }

    if (existing.status === 'COMPLETED') {
      return {
        kind: 'replayed',
        response: existing.responseSnapshot as TResult,
        record: existing
      };
    }

    return {
      kind: 'in_progress_duplicate',
      record: existing
    };
  }

  const createdAt = now().toISOString();
  const inProgressRecord: IdempotencyRecord = {
    scope: input.scope,
    idempotencyKey: input.idempotencyKey,
    requestHash,
    status: 'IN_PROGRESS',
    createdAt,
    updatedAt: createdAt
  };

  await input.storage.create(inProgressRecord);

  try {
    const response = await input.execute();
    const completedRecord: IdempotencyRecord = {
      ...inProgressRecord,
      status: 'COMPLETED',
      responseSnapshot: safeClone(response),
      responseHash: hashRequestIntent(response),
      updatedAt: now().toISOString()
    };

    await input.storage.update(completedRecord);

    return {
      kind: 'executed',
      response,
      record: completedRecord
    };
  } catch (error: unknown) {
    const failedRecord: IdempotencyRecord = {
      ...inProgressRecord,
      status: 'FAILED',
      updatedAt: now().toISOString()
    };

    await input.storage.update(failedRecord);
    throw error;
  }
}

export type IdempotentEventStageInput = {
  scope: string;
  eventId: string;
  stage: string;
  eventIntent: unknown;
  storage: IdempotencyStorageAdapter;
  process: () => Promise<void>;
  now?: () => Date;
};

export type IdempotentEventStageResult =
  | { kind: 'processed'; record: IdempotencyRecord }
  | { kind: 'duplicate'; record: IdempotencyRecord }
  | { kind: 'conflicting_duplicate'; record: IdempotencyRecord }
  | { kind: 'in_progress_duplicate'; record: IdempotencyRecord };

export async function processIdempotentEventStage(
  input: IdempotentEventStageInput
): Promise<IdempotentEventStageResult> {
  const result = await processIdempotentApiRequest<void>({
    scope: `${input.scope}:${input.stage}`,
    idempotencyKey: input.eventId,
    requestIntent: input.eventIntent,
    execute: input.process,
    storage: input.storage,
    now: input.now
  });

  if (result.kind === 'executed') {
    return { kind: 'processed', record: result.record };
  }

  if (result.kind === 'replayed') {
    return { kind: 'duplicate', record: result.record };
  }

  if (result.kind === 'in_progress_duplicate') {
    return { kind: 'in_progress_duplicate', record: result.record };
  }

  return { kind: 'conflicting_duplicate', record: result.record };
}

export function hashRequestIntent(input: unknown): string {
  const canonical = stableStringify(input);
  return createHash('sha256').update(canonical).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

function safeClone<T>(value: T): T {
  return structuredClone(value);
}

function cloneRecord(record: IdempotencyRecord): IdempotencyRecord {
  return structuredClone(record);
}
