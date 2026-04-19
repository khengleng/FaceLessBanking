export type FeatureFlag = {
  flagKey: string;
  description: string;
  enabled: boolean;
  environments: string[];
  roles: string[];
  createdAt: string;
  updatedAt: string;
};

export type NewFeatureFlag = {
  flagKey: string;
  description: string;
  enabled: boolean;
  environments: string[];
  roles: string[];
};

export function buildFeatureFlag(input: NewFeatureFlag): FeatureFlag {
  const now = new Date().toISOString();

  return {
    flagKey: input.flagKey,
    description: input.description,
    enabled: input.enabled,
    environments: input.environments,
    roles: input.roles,
    createdAt: now,
    updatedAt: now
  };
}
