import type { InMemoryConfigStoreAdapter } from '../adapters/config-store.adapter.js';
import type { ConfigEventsAdapter } from '../events/config-events.adapter.js';
import type { ConfigEntry, ConfigValue, RuntimeConfig } from '../domain/runtime-config.js';

export type UpsertConfigInput = {
  idempotencyKey: string | undefined;
  key: unknown;
  value: unknown;
  updatedBy: unknown;
  reason: unknown;
};

export type UpsertConfigResult =
  | { kind: 'updated'; entry: ConfigEntry }
  | { kind: 'duplicate' }
  | { kind: 'invalid'; errors: string[] };

export type ToggleFeatureFlagInput = {
  flagKey: string;
  enabled: unknown;
  idempotencyKey: string | undefined;
};

export type ToggleFeatureFlagResult =
  | { kind: 'updated'; flag: { flagKey: string; enabled: boolean } }
  | { kind: 'duplicate' }
  | { kind: 'invalid'; errors: string[] };

export class ConfigApplication {
  constructor(
    private readonly configStore: InMemoryConfigStoreAdapter,
    private readonly events: ConfigEventsAdapter
  ) {}

  async getConfig(): Promise<RuntimeConfig> {
    const config = await this.configStore.getConfig();
    return {
      entries: config.entries.map(maskEntryIfSensitive),
      updatedAt: config.updatedAt
    };
  }

  async getConfigByKey(key: string): Promise<{ kind: 'found'; entry: ConfigEntry } | { kind: 'not_found' } | { kind: 'invalid'; errors: string[] }> {
    const normalizedKey = normalizeConfigKey(key);
    if (!normalizedKey) {
      return {
        kind: 'invalid',
        errors: ['key must contain at least 2 characters']
      };
    }

    const entry = await this.configStore.getEntryByKey(normalizedKey);
    if (!entry) {
      return { kind: 'not_found' };
    }

    return {
      kind: 'found',
      entry: maskEntryIfSensitive(entry)
    };
  }

  async updateConfig(input: UpsertConfigInput): Promise<UpsertConfigResult> {
    const validation = validateUpsertInput(input);
    const errors = validation.errors;
    if (errors.length > 0) {
      return { kind: 'invalid', errors };
    }

    const idempotencyKey = input.idempotencyKey as string;
    const alreadyProcessed = await this.configStore.hasProcessedIdempotencyKey(idempotencyKey);
    if (alreadyProcessed) {
      return { kind: 'duplicate' };
    }

    const entry = await this.configStore.upsertEntry({
      key: validation.key,
      value: validation.value,
      updatedBy: validation.updatedBy,
      reason: validation.reason
    });
    const config = await this.configStore.getConfig();
    await this.configStore.markIdempotencyKeyProcessed(idempotencyKey);
    await this.events.emitConfigUpdated(config);

    return { kind: 'updated', entry: maskEntryIfSensitive(entry) };
  }

  async getFeatureFlag(flagKey: string): Promise<{ flagKey: string; enabled: boolean } | null> {
    const normalizedFlagKey = normalizeFlagKey(flagKey);
    if (!normalizedFlagKey) {
      return null;
    }

    const entry = await this.configStore.getEntryByKey(featureFlagConfigKey(normalizedFlagKey));
    const value = entry?.value;

    return {
      flagKey: normalizedFlagKey,
      enabled: value === true
    };
  }

  async toggleFeatureFlag(input: ToggleFeatureFlagInput): Promise<ToggleFeatureFlagResult> {
    const errors = validateToggleFeatureFlagInput(input);
    if (errors.length > 0) {
      return { kind: 'invalid', errors };
    }

    const idempotencyKey = input.idempotencyKey as string;
    const alreadyProcessed = await this.configStore.hasProcessedIdempotencyKey(idempotencyKey);
    if (alreadyProcessed) {
      return { kind: 'duplicate' };
    }

    const normalizedFlagKey = normalizeFlagKey(input.flagKey) as string;
    const enabled = input.enabled as boolean;

    await this.configStore.upsertEntry({
      key: featureFlagConfigKey(normalizedFlagKey),
      value: enabled,
      updatedBy: 'feature-flag-service',
      reason: 'feature_flag_toggle'
    });
    const config = await this.configStore.getConfig();
    await this.configStore.markIdempotencyKeyProcessed(idempotencyKey);
    await this.events.emitConfigUpdated(config);

    return {
      kind: 'updated',
      flag: {
        flagKey: normalizedFlagKey,
        enabled
      }
    };
  }
}

function validateUpsertInput(input: UpsertConfigInput): {
  errors: string[];
  key: string;
  value: ConfigValue;
  updatedBy: string;
  reason: string;
} {
  const errors: string[] = [];

  if (!input.idempotencyKey || input.idempotencyKey.trim().length < 4) {
    errors.push('idempotency-key header is required');
  }

  const key = normalizeConfigKey(input.key);
  if (!key) {
    errors.push('key must contain at least 2 characters');
  }

  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length < 3) {
    errors.push('reason must contain at least 3 characters');
  }

  const updatedBy = typeof input.updatedBy === 'string' && input.updatedBy.trim().length > 0
    ? input.updatedBy.trim()
    : 'unknown';

  const valueValidationErrors = validateValueByKey(key, input.value);
  errors.push(...valueValidationErrors);

  return {
    errors,
    key: key ?? '',
    value: normalizeConfigValue(input.value),
    updatedBy,
    reason
  };
}

function validateToggleFeatureFlagInput(input: ToggleFeatureFlagInput): string[] {
  const errors: string[] = [];

  if (!normalizeFlagKey(input.flagKey)) {
    errors.push('flagKey must contain at least 2 characters');
  }

  if (typeof input.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }

  if (!input.idempotencyKey || input.idempotencyKey.trim().length < 4) {
    errors.push('idempotency-key header is required');
  }

  return errors;
}

function featureFlagConfigKey(flagKey: string): string {
  return `featureFlags.${flagKey}`;
}

function normalizeConfigKey(key: unknown): string | null {
  if (typeof key !== 'string') {
    return null;
  }

  const normalized = key.trim();
  if (normalized.length < 2) {
    return null;
  }

  return normalized;
}

function normalizeConfigValue(value: unknown): ConfigValue {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value;
  }

  return null;
}

function validateValueByKey(key: string | null, value: unknown): string[] {
  const errors: string[] = [];
  if (!key) {
    return errors;
  }

  if (key === 'defaultCurrency') {
    if (typeof value !== 'string' || !['USD', 'KHR', 'EUR'].includes(value)) {
      errors.push('defaultCurrency must be one of: USD, KHR, EUR');
    }
    return errors;
  }

  if (key === 'maxRetry') {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10) {
      errors.push('maxRetry must be a number between 0 and 10');
    }
    return errors;
  }

  if (key.startsWith('featureFlags.')) {
    if (typeof value !== 'boolean') {
      errors.push(`${key} must be a boolean`);
    }
    return errors;
  }

  if (isSecretLikeKey(key)) {
    if (typeof value !== 'string' || value.trim().length < 1) {
      errors.push(`${key} must be a non-empty string`);
    }
    return errors;
  }

  if (
    value !== null
    && typeof value !== 'string'
    && typeof value !== 'number'
    && typeof value !== 'boolean'
  ) {
    errors.push('value must be string, number, boolean, or null');
  }

  return errors;
}

function isSecretLikeKey(key: string): boolean {
  const lowered = key.toLowerCase();
  return (
    lowered.includes('secret')
    || lowered.includes('token')
    || lowered.includes('password')
    || lowered.includes('apikey')
    || key.includes('apiKey')
  );
}

function maskEntryIfSensitive(entry: ConfigEntry): ConfigEntry {
  if (!isSecretLikeKey(entry.key)) {
    return entry;
  }

  return {
    ...entry,
    value: entry.value === null ? null : '***REDACTED***'
  };
}

function normalizeFlagKey(flagKey: string): string | null {
  if (!flagKey || typeof flagKey !== 'string') {
    return null;
  }

  const normalized = flagKey.trim();
  if (normalized.length < 2) {
    return null;
  }

  return normalized;
}
