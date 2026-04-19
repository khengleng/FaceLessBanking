import crypto from 'node:crypto';

import { RBAC_PERMISSIONS, type AssignRoleInput, type CreateRoleInput, type Role, type UserRole } from '../domain/rbac.js';

export interface RbacStoreAdapter {
  createRole(input: CreateRoleInput): Promise<Role>;
  getRoleById(roleId: string): Promise<Role | null>;
  getRoleByName(name: string): Promise<Role | null>;
  assignRole(input: AssignRoleInput): Promise<UserRole>;
  getUserRoles(userId: string): Promise<UserRole[]>;
  getIdempotencyResult(scope: string, idempotencyKey: string): Promise<{ id: string } | null>;
  setIdempotencyResult(scope: string, idempotencyKey: string, value: { id: string }): Promise<void>;
}

export class InMemoryRbacStoreAdapter implements RbacStoreAdapter {
  private readonly roles = new Map<string, Role>();

  private readonly userRoles: UserRole[] = [];

  private readonly idempotency = new Map<string, { id: string }>();

  constructor() {
    const now = new Date().toISOString();
    const adminRole: Role = {
      roleId: 'role-rbac-admin',
      name: 'RBAC_ADMIN',
      permissions: [RBAC_PERMISSIONS.CREATE_ROLE, RBAC_PERMISSIONS.ASSIGN_ROLE],
      createdAt: now
    };

    this.roles.set(adminRole.roleId, adminRole);
    this.userRoles.push({ userId: 'rbac-admin', roleId: adminRole.roleId, assignedAt: now });
  }

  async createRole(input: CreateRoleInput): Promise<Role> {
    const role: Role = {
      roleId: crypto.randomUUID(),
      name: input.name,
      permissions: input.permissions,
      createdAt: new Date().toISOString()
    };

    this.roles.set(role.roleId, role);
    return role;
  }

  async getRoleById(roleId: string): Promise<Role | null> {
    return this.roles.get(roleId) ?? null;
  }

  async getRoleByName(name: string): Promise<Role | null> {
    for (const role of this.roles.values()) {
      if (role.name === name) {
        return role;
      }
    }

    return null;
  }

  async assignRole(input: AssignRoleInput): Promise<UserRole> {
    const existing = this.userRoles.find((userRole) => userRole.userId === input.userId && userRole.roleId === input.roleId);
    if (existing) {
      return existing;
    }

    const userRole: UserRole = {
      userId: input.userId,
      roleId: input.roleId,
      assignedAt: new Date().toISOString()
    };

    this.userRoles.push(userRole);
    return userRole;
  }

  async getUserRoles(userId: string): Promise<UserRole[]> {
    return this.userRoles.filter((userRole) => userRole.userId === userId);
  }

  async getIdempotencyResult(scope: string, idempotencyKey: string): Promise<{ id: string } | null> {
    return this.idempotency.get(`${scope}:${idempotencyKey}`) ?? null;
  }

  async setIdempotencyResult(scope: string, idempotencyKey: string, value: { id: string }): Promise<void> {
    this.idempotency.set(`${scope}:${idempotencyKey}`, value);
  }
}
