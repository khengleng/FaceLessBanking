import crypto from 'node:crypto';

import {
  RBAC_ADMIN_ROLE_NAME,
  RBAC_MANAGEMENT_PERMISSIONS,
  type Permission,
  type Role,
  type RoleWithPermissions,
  type UserRole
} from '../domain/rbac.js';

export interface RbacPostgresAdapter {
  createRole(input: { roleName: string; description: string; permissionIds: string[] }): Promise<RoleWithPermissions>;
  getRoleById(roleId: string): Promise<RoleWithPermissions | null>;
  createPermission(input: { permissionName: string; resource: string; action: string }): Promise<Permission>;
  assignRoleToUser(input: { userId: string; roleId: string }): Promise<UserRole>;
  listRolesByUser(userId: string): Promise<RoleWithPermissions[]>;
  roleExists(roleName: string): Promise<boolean>;
  permissionExists(permissionName: string): Promise<boolean>;
  getPermissionById(permissionId: string): Promise<Permission | null>;
  getPermissionByName(permissionName: string): Promise<Permission | null>;
  getAssignmentByUserAndRole(input: { userId: string; roleId: string }): Promise<UserRole | null>;
  getIdempotencyResult(scope: string, key: string): Promise<{ id: string } | null>;
  setIdempotencyResult(scope: string, key: string, value: { id: string }): Promise<void>;
}

export class InMemoryRbacPostgresAdapter implements RbacPostgresAdapter {
  private readonly roles = new Map<string, Role>();

  private readonly permissions = new Map<string, Permission>();

  private readonly rolePermissions = new Map<string, Set<string>>();

  private readonly userRoles: UserRole[] = [];

  private readonly idempotency = new Map<string, { id: string }>();

  constructor() {
    const adminRoleId = 'role-rbac-admin';
    const now = new Date().toISOString();

    const adminRole: Role = {
      roleId: adminRoleId,
      roleName: RBAC_ADMIN_ROLE_NAME,
      description: 'Bootstrap RBAC administrator role'
    };

    this.roles.set(adminRole.roleId, adminRole);
    this.rolePermissions.set(adminRole.roleId, new Set());

    const bootstrapPermissions = [
      RBAC_MANAGEMENT_PERMISSIONS.ROLE_CREATE,
      RBAC_MANAGEMENT_PERMISSIONS.PERMISSION_CREATE,
      RBAC_MANAGEMENT_PERMISSIONS.ROLE_ASSIGN
    ];

    for (const permissionName of bootstrapPermissions) {
      const permission: Permission = {
        permissionId: crypto.randomUUID(),
        permissionName,
        resource: permissionName.split('.')[1] ?? 'rbac',
        action: permissionName.split('.')[2] ?? 'manage'
      };

      this.permissions.set(permission.permissionId, permission);
      this.rolePermissions.get(adminRoleId)?.add(permission.permissionId);
    }

    this.userRoles.push({
      userRoleId: crypto.randomUUID(),
      userId: 'rbac-admin',
      roleId: adminRoleId,
      assignedAt: now
    });
  }

  async createRole(input: {
    roleName: string;
    description: string;
    permissionIds: string[];
  }): Promise<RoleWithPermissions> {
    const role: Role = {
      roleId: crypto.randomUUID(),
      roleName: input.roleName,
      description: input.description
    };

    this.roles.set(role.roleId, role);
    this.rolePermissions.set(role.roleId, new Set(input.permissionIds));

    return {
      ...role,
      permissions: input.permissionIds
        .map((permissionId) => this.permissions.get(permissionId))
        .filter((permission): permission is Permission => permission !== undefined)
    };
  }

  async getRoleById(roleId: string): Promise<RoleWithPermissions | null> {
    const role = this.roles.get(roleId);
    if (!role) {
      return null;
    }

    const permissionIds = [...(this.rolePermissions.get(roleId) ?? [])];
    const permissions = permissionIds
      .map((permissionId) => this.permissions.get(permissionId))
      .filter((permission): permission is Permission => permission !== undefined);

    return {
      ...role,
      permissions
    };
  }

  async createPermission(input: {
    permissionName: string;
    resource: string;
    action: string;
  }): Promise<Permission> {
    const permission: Permission = {
      permissionId: crypto.randomUUID(),
      permissionName: input.permissionName,
      resource: input.resource,
      action: input.action
    };

    this.permissions.set(permission.permissionId, permission);
    return permission;
  }

  async assignRoleToUser(input: { userId: string; roleId: string }): Promise<UserRole> {
    const existing = await this.getAssignmentByUserAndRole(input);
    if (existing) {
      return existing;
    }

    const userRole: UserRole = {
      userRoleId: crypto.randomUUID(),
      userId: input.userId,
      roleId: input.roleId,
      assignedAt: new Date().toISOString()
    };

    this.userRoles.push(userRole);
    return userRole;
  }

  async listRolesByUser(userId: string): Promise<RoleWithPermissions[]> {
    const assigned = this.userRoles.filter((entry) => entry.userId === userId);
    const roles: RoleWithPermissions[] = [];

    for (const item of assigned) {
      const role = await this.getRoleById(item.roleId);
      if (role) {
        roles.push(role);
      }
    }

    return roles;
  }

  async roleExists(roleName: string): Promise<boolean> {
    for (const role of this.roles.values()) {
      if (role.roleName === roleName) {
        return true;
      }
    }

    return false;
  }

  async permissionExists(permissionName: string): Promise<boolean> {
    for (const permission of this.permissions.values()) {
      if (permission.permissionName === permissionName) {
        return true;
      }
    }

    return false;
  }

  async getPermissionById(permissionId: string): Promise<Permission | null> {
    return this.permissions.get(permissionId) ?? null;
  }

  async getPermissionByName(permissionName: string): Promise<Permission | null> {
    for (const permission of this.permissions.values()) {
      if (permission.permissionName === permissionName) {
        return permission;
      }
    }

    return null;
  }

  async getAssignmentByUserAndRole(input: { userId: string; roleId: string }): Promise<UserRole | null> {
    const found = this.userRoles.find((entry) => entry.userId === input.userId && entry.roleId === input.roleId);
    return found ?? null;
  }

  async getIdempotencyResult(scope: string, key: string): Promise<{ id: string } | null> {
    return this.idempotency.get(`${scope}:${key}`) ?? null;
  }

  async setIdempotencyResult(scope: string, key: string, value: { id: string }): Promise<void> {
    this.idempotency.set(`${scope}:${key}`, value);
  }
}
