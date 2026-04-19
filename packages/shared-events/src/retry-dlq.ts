import { randomUUID } from 'node:crypto';

export type RetryMetadata = {
  retryCount: number;
  maxRetries: number;
  nextAttemptAt?: string;
};

export type RetryPolicy = {
  maxRetries: number;
  baseDelayMs?: number;
  strategy?: 'fixed' | 'exponential';
};

export type DeadLetterRecord = {
  deadLetterId: string;
  sourceEventId: string;
  sourceTopic: string;
  payload: unknown;
  errorMessage: string;
  retryCount: number;
  createdAt: string;
};

export interface DeadLetterStore {
  create(record: DeadLetterRecord): Promise<void>;
}

export class InMemoryDeadLetterStore implements DeadLetterStore {
  public readonly records: DeadLetterRecord[] = [];

  async create(record: DeadLetterRecord): Promise<void> {
    this.records.push(record);
  }
}

export class TransientProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientProcessingError';
  }
}

export class PermanentProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentProcessingError';
  }
}

export class MalformedEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedEventError';
  }
}

export type ParseEventResult<TEvent> =
  | { ok: true; event: TEvent }
  | { ok: false; error: string };

export type RetryDlqProcessInput<TEvent> = {
  rawEvent: unknown;
  sourceTopic: string;
  retryPolicy: RetryPolicy;
  deadLetterStore: DeadLetterStore;
  parseEvent: (rawEvent: unknown) => ParseEventResult<TEvent>;
  handler: (event: TEvent, metadata: RetryMetadata) => Promise<void>;
  isTransientError?: (error: unknown) => boolean;
  now?: () => Date;
};

export type RetryDlqProcessResult =
  | {
      kind: 'processed';
      attempts: number;
      retryCount: number;
    }
  | {
      kind: 'dead_lettered';
      attempts: number;
      retryCount: number;
      reason: string;
      deadLetterRecord: DeadLetterRecord;
    };

export async function processWithRetryAndDlq<TEvent>(
  input: RetryDlqProcessInput<TEvent>
): Promise<RetryDlqProcessResult> {
  const now = input.now ?? (() => new Date());
  const policy = normalizeRetryPolicy(input.retryPolicy);
  const parsed = input.parseEvent(input.rawEvent);

  if (!parsed.ok) {
    const dlq = buildDeadLetterRecord({
      sourceEventId: extractSourceEventId(input.rawEvent),
      sourceTopic: input.sourceTopic,
      payload: input.rawEvent,
      errorMessage: `malformed_event:${parsed.error}`,
      retryCount: 0,
      now
    });

    await input.deadLetterStore.create(dlq);
    return {
      kind: 'dead_lettered',
      attempts: 1,
      retryCount: 0,
      reason: 'malformed_event',
      deadLetterRecord: dlq
    };
  }

  for (let retryCount = 0; retryCount <= policy.maxRetries; retryCount += 1) {
    const nextAttemptAt =
      retryCount < policy.maxRetries
        ? calculateNextAttemptAt({ retryCount: retryCount + 1, policy, now })
        : undefined;

    const metadata: RetryMetadata = {
      retryCount,
      maxRetries: policy.maxRetries,
      nextAttemptAt
    };

    try {
      await input.handler(parsed.event, metadata);
      return {
        kind: 'processed',
        attempts: retryCount + 1,
        retryCount
      };
    } catch (error: unknown) {
      const isTransient = (input.isTransientError ?? defaultIsTransientError)(error);
      const exhausted = retryCount >= policy.maxRetries;

      if (!isTransient || exhausted) {
        const dlq = buildDeadLetterRecord({
          sourceEventId: extractSourceEventId(parsed.event),
          sourceTopic: input.sourceTopic,
          payload: parsed.event,
          errorMessage: normalizeErrorMessage(error),
          retryCount,
          now
        });

        await input.deadLetterStore.create(dlq);
        return {
          kind: 'dead_lettered',
          attempts: retryCount + 1,
          retryCount,
          reason: isTransient ? 'retry_exhausted' : 'permanent_failure',
          deadLetterRecord: dlq
        };
      }
    }
  }

  const unreachableDlq = buildDeadLetterRecord({
    sourceEventId: extractSourceEventId(parsed.event),
    sourceTopic: input.sourceTopic,
    payload: parsed.event,
    errorMessage: 'unreachable_retry_state',
    retryCount: policy.maxRetries,
    now
  });
  await input.deadLetterStore.create(unreachableDlq);

  return {
    kind: 'dead_lettered',
    attempts: policy.maxRetries + 1,
    retryCount: policy.maxRetries,
    reason: 'retry_exhausted',
    deadLetterRecord: unreachableDlq
  };
}

function normalizeRetryPolicy(policy: RetryPolicy): Required<RetryPolicy> {
  const maxRetries = Number.isFinite(policy.maxRetries) ? Math.max(0, Math.trunc(policy.maxRetries)) : 0;
  const baseDelayMs =
    Number.isFinite(policy.baseDelayMs ?? 0) && (policy.baseDelayMs ?? 0) >= 0
      ? Math.trunc(policy.baseDelayMs ?? 0)
      : 0;

  return {
    maxRetries,
    baseDelayMs,
    strategy: policy.strategy ?? 'fixed'
  };
}

function calculateNextAttemptAt(input: {
  retryCount: number;
  policy: Required<RetryPolicy>;
  now: () => Date;
}): string {
  const multiplier = input.policy.strategy === 'exponential' ? 2 ** Math.max(0, input.retryCount - 1) : 1;
  const delayMs = input.policy.baseDelayMs * multiplier;
  return new Date(input.now().getTime() + delayMs).toISOString();
}

function buildDeadLetterRecord(input: {
  sourceEventId: string;
  sourceTopic: string;
  payload: unknown;
  errorMessage: string;
  retryCount: number;
  now: () => Date;
}): DeadLetterRecord {
  return {
    deadLetterId: randomUUID(),
    sourceEventId: input.sourceEventId,
    sourceTopic: input.sourceTopic,
    payload: clonePayload(input.payload),
    errorMessage: input.errorMessage,
    retryCount: input.retryCount,
    createdAt: input.now().toISOString()
  };
}

function clonePayload(payload: unknown): unknown {
  return structuredClone(payload);
}

function extractSourceEventId(event: unknown): string {
  if (!event || typeof event !== 'object') {
    return 'unknown_source_event';
  }

  const asRecord = event as Record<string, unknown>;
  const metadata = asRecord.metadata;

  if (metadata && typeof metadata === 'object') {
    const eventId = (metadata as Record<string, unknown>).eventId;
    if (typeof eventId === 'string' && eventId.trim().length > 0) {
      return eventId;
    }
  }

  const sourceEventId = asRecord.sourceEventId;
  if (typeof sourceEventId === 'string' && sourceEventId.trim().length > 0) {
    return sourceEventId;
  }

  return 'unknown_source_event';
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'unknown_processing_error';
}

function defaultIsTransientError(error: unknown): boolean {
  if (error instanceof PermanentProcessingError || error instanceof MalformedEventError) {
    return false;
  }

  return true;
}
