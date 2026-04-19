import { apiClient, type ApiClient } from './client';

export type AdminRole = {
  roleId: string;
  roleName: string;
  description: string;
  permissionIds?: string[];
};

export type AdminPermission = {
  permissionId: string;
  permissionName: string;
  resource: string;
  action: string;
};

export type FeatureFlagRecord = {
  flagKey: string;
  description: string;
  enabled: boolean;
  environments: string[];
  roles: string[];
  updatedAt?: string;
};

export type ConfigRecord = {
  key: string;
  value: unknown;
  updatedAt?: string;
  updatedBy?: string;
  reason?: string;
};

export type MakerCheckerPolicy = {
  policyId: string;
  actionType: string;
  enabled: boolean;
  thresholdAmount?: number;
  caseType: string;
  createdAt: string;
};

export interface AdministrationClient {
  createRole(input: { roleName: string; description: string; permissionIds?: string[] }): Promise<AdminRole>;
  createPermission(input: { permissionName: string; resource: string; action: string }): Promise<AdminPermission>;
  assignRole(input: { userId: string; roleId: string }): Promise<{ userRoleId?: string; userId: string; roleId: string; created?: boolean }>;
  getRoleById(roleId: string): Promise<AdminRole>;
  getUserRoles(userId: string): Promise<{ userId: string; roles: AdminRole[] }>;

  listFeatureFlags(): Promise<FeatureFlagRecord[]>;
  getFeatureFlag(flagKey: string): Promise<FeatureFlagRecord>;
  upsertFeatureFlag(input: {
    flagKey: string;
    description: string;
    enabled: boolean;
    environments: string[];
    roles: string[];
  }): Promise<FeatureFlagRecord>;

  listConfig(): Promise<ConfigRecord[]>;
  getConfigByKey(key: string): Promise<ConfigRecord>;
  upsertConfig(input: { key: string; value: unknown; reason?: string }): Promise<ConfigRecord>;

  createMakerCheckerPolicy(input: {
    actionType: string;
    enabled?: boolean;
    thresholdAmount?: number;
    caseType: string;
  }): Promise<MakerCheckerPolicy>;
  getMakerCheckerPolicy(policyId: string): Promise<MakerCheckerPolicy>;
}

export class HttpAdministrationClient implements AdministrationClient {
  constructor(private readonly client: ApiClient = apiClient) {}

  async createRole(input: { roleName: string; description: string; permissionIds?: string[] }): Promise<AdminRole> {
    const response = await this.client.request<unknown>('/auth/roles', {
      method: 'POST',
      headers: {
        'x-user-id': 'admin-portal-admin',
        'x-idempotency-key': buildIdempotencyKey()
      },
      body: {
        roleName: input.roleName,
        description: input.description,
        permissionIds: input.permissionIds ?? []
      }
    });

    return mapRole(selectDataNode(response));
  }

  async createPermission(input: { permissionName: string; resource: string; action: string }): Promise<AdminPermission> {
    const response = await this.client.request<unknown>('/auth/permissions', {
      method: 'POST',
      headers: {
        'x-user-id': 'admin-portal-admin',
        'x-idempotency-key': buildIdempotencyKey()
      },
      body: input
    });

    const node = selectDataNode(response);
    return {
      permissionId: readString(node, ['permissionId']) ?? 'unknown-permission',
      permissionName: readString(node, ['permissionName']) ?? input.permissionName,
      resource: readString(node, ['resource']) ?? input.resource,
      action: readString(node, ['action']) ?? input.action
    };
  }

  async assignRole(input: { userId: string; roleId: string }): Promise<{ userRoleId?: string; userId: string; roleId: string; created?: boolean }> {
    const response = await this.client.request<unknown>('/auth/assign', {
      method: 'POST',
      headers: {
        'x-user-id': 'admin-portal-admin',
        'x-idempotency-key': buildIdempotencyKey()
      },
      body: input
    });

    const node = selectDataNode(response);

    return {
      userRoleId: readString(node, ['userRoleId']),
      userId: readString(node, ['userId']) ?? input.userId,
      roleId: readString(node, ['roleId']) ?? input.roleId,
      created: readBoolean(node, ['created'])
    };
  }

  async getRoleById(roleId: string): Promise<AdminRole> {
    const response = await this.client.request<unknown>(`/auth/roles/${encodeURIComponent(roleId)}`);
    return mapRole(selectDataNode(response));
  }

  async getUserRoles(userId: string): Promise<{ userId: string; roles: AdminRole[] }> {
    const response = await this.client.request<unknown>(`/auth/users/${encodeURIComponent(userId)}/roles`);
    const node = selectDataNode(response);
    const roles = extractArray(node, ['roles']).map(mapRole);

    return {
      userId: readString(node, ['userId']) ?? userId,
      roles
    };
  }

  async listFeatureFlags(): Promise<FeatureFlagRecord[]> {
    const response = await this.client.request<unknown>('/feature-flags');
    return extractArray(response, ['data.items', 'items', 'data']).map((item) => mapFeatureFlag(selectDataNode(item)));
  }

  async getFeatureFlag(flagKey: string): Promise<FeatureFlagRecord> {
    const response = await this.client.request<unknown>(`/feature-flags/${encodeURIComponent(flagKey)}`);
    return mapFeatureFlag(selectDataNode(response));
  }

  async upsertFeatureFlag(input: {
    flagKey: string;
    description: string;
    enabled: boolean;
    environments: string[];
    roles: string[];
  }): Promise<FeatureFlagRecord> {
    const response = await this.client.request<unknown>('/feature-flags', {
      method: 'POST',
      headers: {
        'idempotency-key': buildIdempotencyKey()
      },
      body: input
    });

    return mapFeatureFlag(selectDataNode(response));
  }

  async listConfig(): Promise<ConfigRecord[]> {
    const response = await this.client.request<unknown>('/config');
    const node = selectDataNode(response);

    if (Array.isArray(node)) {
      return node.map((item) => mapConfigRecord(item));
    }

    if (node && typeof node === 'object') {
      return Object.entries(node as Record<string, unknown>).map(([key, value]) => ({ key, value }));
    }

    return [];
  }

  async getConfigByKey(key: string): Promise<ConfigRecord> {
    const response = await this.client.request<unknown>(`/config/${encodeURIComponent(key)}`);
    return mapConfigRecord(selectDataNode(response));
  }

  async upsertConfig(input: { key: string; value: unknown; reason?: string }): Promise<ConfigRecord> {
    const response = await this.client.request<unknown>('/config', {
      method: 'POST',
      headers: {
        'idempotency-key': buildIdempotencyKey(),
        'x-actor-id': 'admin-portal-admin'
      },
      body: input
    });

    return mapConfigRecord(selectDataNode(response));
  }

  async createMakerCheckerPolicy(input: {
    actionType: string;
    enabled?: boolean;
    thresholdAmount?: number;
    caseType: string;
  }): Promise<MakerCheckerPolicy> {
    const response = await this.client.request<unknown>('/maker-checker/policies', {
      method: 'POST',
      body: input
    });

    return mapMakerCheckerPolicy(selectDataNode(response));
  }

  async getMakerCheckerPolicy(policyId: string): Promise<MakerCheckerPolicy> {
    const response = await this.client.request<unknown>(`/maker-checker/policies/${encodeURIComponent(policyId)}`);
    return mapMakerCheckerPolicy(selectDataNode(response));
  }
}

function mapRole(value: unknown): AdminRole {
  const node = selectDataNode(value);

  return {
    roleId: readString(node, ['roleId']) ?? 'unknown-role',
    roleName: readString(node, ['roleName']) ?? 'unknown-role',
    description: readString(node, ['description']) ?? '',
    permissionIds: extractArray(node, ['permissionIds']).map((entry) => String(entry))
  };
}

function mapFeatureFlag(value: unknown): FeatureFlagRecord {
  const node = selectDataNode(value);

  return {
    flagKey: readString(node, ['flagKey']) ?? 'unknown.flag',
    description: readString(node, ['description']) ?? '',
    enabled: readBoolean(node, ['enabled']) ?? false,
    environments: extractArray(node, ['environments']).map((entry) => String(entry)),
    roles: extractArray(node, ['roles']).map((entry) => String(entry)),
    updatedAt: readString(node, ['updatedAt'])
  };
}

function mapConfigRecord(value: unknown): ConfigRecord {
  const node = selectDataNode(value);

  return {
    key: readString(node, ['key']) ?? 'unknown.key',
    value: readUnknown(node, ['value']),
    updatedAt: readString(node, ['updatedAt']),
    updatedBy: readString(node, ['updatedBy']),
    reason: readString(node, ['reason'])
  };
}

function mapMakerCheckerPolicy(value: unknown): MakerCheckerPolicy {
  const node = selectDataNode(value);

  return {
    policyId: readString(node, ['policyId']) ?? 'unknown-policy',
    actionType: readString(node, ['actionType']) ?? 'UNKNOWN',
    enabled: readBoolean(node, ['enabled']) ?? false,
    thresholdAmount: readNumber(node, ['thresholdAmount']),
    caseType: readString(node, ['caseType']) ?? 'onboarding-review',
    createdAt: readString(node, ['createdAt']) ?? new Date(0).toISOString()
  };
}

function buildIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `admin-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function selectDataNode(value: unknown): unknown {
  const data = readUnknown(value, ['data']);
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data;
  }

  return value;
}

function extractArray(value: unknown, pathHints: string[]): unknown[] {
  for (const hint of pathHints) {
    const found = readUnknown(value, hint.split('.'));
    if (Array.isArray(found)) {
      return found;
    }
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [];
}

function readUnknown(value: unknown, path: string[]): unknown {
  let current: unknown = value;

  for (const key of path) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

function readString(value: unknown, path: string[]): string | undefined {
  const found = readUnknown(value, path);
  return typeof found === 'string' ? found : undefined;
}

function readNumber(value: unknown, path: string[]): number | undefined {
  const found = readUnknown(value, path);
  return typeof found === 'number' ? found : undefined;
}

function readBoolean(value: unknown, path: string[]): boolean | undefined {
  const found = readUnknown(value, path);
  return typeof found === 'boolean' ? found : undefined;
}
