import type { FeatureFlagStoreAdapter } from '../adapters/feature-flag-store.adapter.js';
import { buildFeatureFlag, type FeatureFlag } from '../domain/feature-flag.js';
import type { FeatureFlagEventsAdapter } from '../events/feature-flag-events.adapter.js';

export type UpsertFeatureFlagInput = {
  idempotencyKey: string | undefined;
  flagKey: unknown;
  description: unknown;
  enabled: unknown;
  environments: unknown;
  roles: unknown;
};

export type UpsertFeatureFlagResult =
  | { kind: 'updated'; flag: FeatureFlag }
  | { kind: 'duplicate' }
  | { kind: 'invalid'; errors: string[] };

export type GetFeatureFlagResult =
  | { kind: 'found'; flag: FeatureFlag }
  | { kind: 'not_found' }
  | { kind: 'invalid'; errors: string[] };

export class FeatureFlagApplication {
  constructor(
    private readonly store: FeatureFlagStoreAdapter,
    private readonly events: FeatureFlagEventsAdapter
  ) {}

  async listFlags(): Promise<FeatureFlag[]> {
    return this.store.listFlags();
  }

  async getFlagByKey(flagKey: string): Promise<GetFeatureFlagResult> {
    const normalizedFlagKey = normalizeFlagKey(flagKey);
    if (!normalizedFlagKey) {
      return {
        kind: 'invalid',
        errors: ['flagKey must contain at least 2 characters']
      };
    }

    const flag = await this.store.getFlagByKey(normalizedFlagKey);
    if (!flag) {
      return { kind: 'not_found' };
    }

    return {
      kind: 'found',
      flag
    };
  }

  async upsertFlag(input: UpsertFeatureFlagInput): Promise<UpsertFeatureFlagResult> {
    const validation = validateUpsertInput(input);
    if (validation.errors.length > 0) {
      return {
        kind: 'invalid',
        errors: validation.errors
      };
    }

    const idempotencyKey = input.idempotencyKey as string;
    const isDuplicate = await this.store.hasProcessedIdempotencyKey(idempotencyKey);
    if (isDuplicate) {
      return { kind: 'duplicate' };
    }

    const existing = await this.store.getFlagByKey(validation.flagKey);
    const flag = existing
      ? {
        ...existing,
        description: validation.description,
        enabled: validation.enabled,
        environments: validation.environments,
        roles: validation.roles,
        updatedAt: new Date().toISOString()
      }
      : buildFeatureFlag({
        flagKey: validation.flagKey,
        description: validation.description,
        enabled: validation.enabled,
        environments: validation.environments,
        roles: validation.roles
      });

    const saved = await this.store.upsertFlag(flag);
    await this.store.markIdempotencyKeyProcessed(idempotencyKey);
    await this.events.emitFeatureFlagUpdated(saved);

    return {
      kind: 'updated',
      flag: saved
    };
  }
}

function validateUpsertInput(input: UpsertFeatureFlagInput): {
  errors: string[];
  flagKey: string;
  description: string;
  enabled: boolean;
  environments: string[];
  roles: string[];
} {
  const errors: string[] = [];

  const flagKey = normalizeFlagKey(input.flagKey);
  if (!flagKey) {
    errors.push('flagKey must contain at least 2 characters');
  }

  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (description.length < 3) {
    errors.push('description must contain at least 3 characters');
  }

  const enabled = input.enabled;
  if (typeof enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }

  const environments = normalizeStringArray(input.environments);
  if (!environments) {
    errors.push('environments must be a string array');
  }

  const roles = normalizeStringArray(input.roles);
  if (!roles) {
    errors.push('roles must be a string array');
  }

  const idempotencyKey = input.idempotencyKey?.trim();
  if (!idempotencyKey || idempotencyKey.length < 4) {
    errors.push('idempotency-key header is required');
  }

  return {
    errors,
    flagKey: flagKey ?? '',
    description,
    enabled: typeof enabled === 'boolean' ? enabled : false,
    environments: environments ?? [],
    roles: roles ?? []
  };
}

function normalizeFlagKey(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length < 2) {
    return null;
  }

  return normalized;
}

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return normalized;
}
