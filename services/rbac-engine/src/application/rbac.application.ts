import type { RbacStoreAdapter } from '../adapters/rbac.adapters.js';
import { type Permission, type Role, type UserRole } from '../domain/rbac.js';

type Logger = {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
};

export class RbacApplication {
  constructor(
    private readonly store: RbacStoreAdapter,
    private readonly logger: Logger
  ) {}

  async hasPermission(userId: string, permission: Permission): Promise<boolean> {
    const userRoles = await this.store.getUserRoles(userId);

    for (const userRole of userRoles) {
      const role = await this.store.getRoleById(userRole.roleId);
      if (!role) {
        continue;
      }

      if (role.permissions.includes(permission)) {
        return true;
      }
    }

    return false;
  }

  async createRole(input: {
    name: string;
    permissions: Permission[];
    idempotencyKey: string;
  }): Promise<Role> {
    const existing = await this.store.getIdempotencyResult('create-role', input.idempotencyKey);
    if (existing) {
      const prior = await this.store.getRoleById(existing.id);
      if (prior) {
        return prior;
      }
    }

    const existingByName = await this.store.getRoleByName(input.name);
    if (existingByName) {
      return existingByName;
    }

    const role = await this.store.createRole({
      name: input.name,
      permissions: [...new Set(input.permissions)]
    });

    await this.store.setIdempotencyResult('create-role', input.idempotencyKey, { id: role.roleId });

    this.logger.info({ roleId: role.roleId, name: role.name }, 'Role created');
    return role;
  }

  async assignRole(input: {
    userId: string;
    roleId: string;
    idempotencyKey: string;
  }): Promise<UserRole> {
    const existing = await this.store.getIdempotencyResult('assign-role', input.idempotencyKey);
    if (existing) {
      const already = await this.store.getUserRoles(input.userId);
      const found = already.find((item) => item.roleId === existing.id);
      if (found) {
        return found;
      }
    }

    const role = await this.store.getRoleById(input.roleId);
    if (!role) {
      throw new Error('role_not_found');
    }

    const userRole = await this.store.assignRole({ userId: input.userId, roleId: input.roleId });
    await this.store.setIdempotencyResult('assign-role', input.idempotencyKey, { id: input.roleId });

    this.logger.info({ userId: userRole.userId, roleId: userRole.roleId }, 'Role assigned to user');
    return userRole;
  }
}
