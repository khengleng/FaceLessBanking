import type { RbacPostgresAdapter } from '../adapters/postgres.adapter.js';
import type { Permission, RoleWithPermissions, UserRole } from '../domain/rbac.js';
import { RbacMetrics } from './rbac.metrics.js';

type Logger = {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
};

export class RbacApplication {
  constructor(
    private readonly adapter: RbacPostgresAdapter,
    private readonly logger: Logger,
    private readonly metrics: RbacMetrics
  ) {}

  async createRole(input: {
    roleName: string;
    description: string;
    permissionIds: string[];
    idempotencyKey: string;
  }): Promise<RoleWithPermissions> {
    const prior = await this.adapter.getIdempotencyResult('roles.create', input.idempotencyKey);
    if (prior) {
      const existing = await this.adapter.getRoleById(prior.id);
      if (existing) {
        return existing;
      }
    }

    if (await this.adapter.roleExists(input.roleName)) {
      throw new Error('role_conflict');
    }

    for (const permissionId of input.permissionIds) {
      const permission = await this.adapter.getPermissionById(permissionId);
      if (!permission) {
        throw new Error('permission_not_found');
      }
    }

    const created = await this.adapter.createRole({
      roleName: input.roleName,
      description: input.description,
      permissionIds: input.permissionIds
    });

    await this.adapter.setIdempotencyResult('roles.create', input.idempotencyKey, { id: created.roleId });
    this.metrics.incrementRolesCreated();
    this.logger.info({ roleId: created.roleId, roleName: created.roleName }, 'Role created');

    return created;
  }

  async getRoleById(roleId: string): Promise<RoleWithPermissions | null> {
    return this.adapter.getRoleById(roleId);
  }

  async createPermission(input: {
    permissionName: string;
    resource: string;
    action: string;
    idempotencyKey: string;
  }): Promise<Permission> {
    const prior = await this.adapter.getIdempotencyResult('permissions.create', input.idempotencyKey);
    if (prior) {
      const existing = await this.adapter.getPermissionById(prior.id);
      if (existing) {
        return existing;
      }
    }

    if (await this.adapter.permissionExists(input.permissionName)) {
      throw new Error('permission_conflict');
    }

    const created = await this.adapter.createPermission({
      permissionName: input.permissionName,
      resource: input.resource,
      action: input.action
    });

    await this.adapter.setIdempotencyResult('permissions.create', input.idempotencyKey, {
      id: created.permissionId
    });

    this.metrics.incrementPermissionsCreated();
    this.logger.info({ permissionId: created.permissionId, permissionName: created.permissionName }, 'Permission created');

    return created;
  }

  async assignRoleToUser(input: {
    userId: string;
    roleId: string;
    idempotencyKey: string;
  }): Promise<{ assignment: UserRole; created: boolean }> {
    const prior = await this.adapter.getIdempotencyResult('roles.assign', input.idempotencyKey);
    if (prior) {
      const existingPrior = await this.adapter.getAssignmentByUserAndRole({
        userId: input.userId,
        roleId: prior.id
      });

      if (existingPrior) {
        return { assignment: existingPrior, created: false };
      }
    }

    const role = await this.adapter.getRoleById(input.roleId);
    if (!role) {
      throw new Error('role_not_found');
    }

    const existing = await this.adapter.getAssignmentByUserAndRole({
      userId: input.userId,
      roleId: input.roleId
    });

    if (existing) {
      this.metrics.incrementDuplicateAssignmentsSkipped();
      return { assignment: existing, created: false };
    }

    const assignment = await this.adapter.assignRoleToUser({
      userId: input.userId,
      roleId: input.roleId
    });

    await this.adapter.setIdempotencyResult('roles.assign', input.idempotencyKey, { id: input.roleId });

    this.metrics.incrementRoleAssignmentsCreated();
    this.logger.info(
      { userRoleId: assignment.userRoleId, userId: assignment.userId, roleId: assignment.roleId },
      'Role assigned to user'
    );

    return { assignment, created: true };
  }

  async listRolesByUser(userId: string): Promise<RoleWithPermissions[]> {
    return this.adapter.listRolesByUser(userId);
  }

  async hasPermission(input: { userId: string; permissionName: string }): Promise<boolean> {
    const permission = await this.adapter.getPermissionByName(input.permissionName);
    if (!permission) {
      // Missing permission definitions are blocked safely by default deny.
      this.logger.warn(
        { userId: input.userId, permissionName: input.permissionName },
        'Permission lookup failed; request denied'
      );
      return false;
    }

    const userRoles = await this.adapter.listRolesByUser(input.userId);
    return userRoles.some((role) => role.permissions.some((item) => item.permissionName === permission.permissionName));
  }
}
