import crypto from 'node:crypto';
import pg from 'pg';
const { Pool } = pg;

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

export class PostgresRbacAdapter implements RbacPostgresAdapter {
  private readonly pool: pg.Pool;

  constructor(pool?: pg.Pool) {
    this.pool = pool ?? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async createRole(input: {
    roleName: string;
    description: string;
    permissionIds: string[];
  }): Promise<RoleWithPermissions> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const roleId = crypto.randomUUID();
      await client.query(
        'INSERT INTO roles (role_id, role_name, description) VALUES ($1, $2, $3)',
        [roleId, input.roleName, input.description]
      );

      if (input.permissionIds.length > 0) {
        for (const pid of input.permissionIds) {
          await client.query(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [roleId, pid]
          );
        }
      }

      await client.query('COMMIT');
      
      return (await this.getRoleById(roleId))!;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async getRoleById(roleId: string): Promise<RoleWithPermissions | null> {
    const roleRes = await this.pool.query('SELECT * FROM roles WHERE role_id = $1', [roleId]);
    if (roleRes.rows.length === 0) return null;

    const role = roleRes.rows[0];
    const permRes = await this.pool.query(
      `SELECT p.* FROM permissions p 
       JOIN role_permissions rp ON p.permission_id = rp.permission_id 
       WHERE rp.role_id = $1`,
      [roleId]
    );

    return {
      roleId: role.role_id,
      roleName: role.role_name,
      description: role.description,
      permissions: permRes.rows.map(row => this.mapRowToPermission(row))
    };
  }

  async createPermission(input: {
    permissionName: string;
    resource: string;
    action: string;
  }): Promise<Permission> {
    const permissionId = crypto.randomUUID();
    await this.pool.query(
      'INSERT INTO permissions (permission_id, permission_name, resource, action) VALUES ($1, $2, $3, $4)',
      [permissionId, input.permissionName, input.resource, input.action]
    );
    return {
      permissionId,
      permissionName: input.permissionName,
      resource: input.resource,
      action: input.action
    };
  }

  async assignRoleToUser(input: { userId: string; roleId: string }): Promise<UserRole> {
    const existing = await this.getAssignmentByUserAndRole(input);
    if (existing) return existing;

    const userRoleId = crypto.randomUUID();
    const assignedAt = new Date().toISOString();
    await this.pool.query(
      'INSERT INTO user_roles (user_role_id, user_id, role_id, assigned_at) VALUES ($1, $2, $3, $4)',
      [userRoleId, input.userId, input.roleId, assignedAt]
    );

    return {
      userRoleId,
      userId: input.userId,
      roleId: input.roleId,
      assignedAt
    };
  }

  async listRolesByUser(userId: string): Promise<RoleWithPermissions[]> {
    const res = await this.pool.query('SELECT role_id FROM user_roles WHERE user_id = $1', [userId]);
    const roles: RoleWithPermissions[] = [];
    for (const row of res.rows) {
      const role = await this.getRoleById(row.role_id);
      if (role) roles.push(role);
    }
    return roles;
  }

  async roleExists(roleName: string): Promise<boolean> {
    const res = await this.pool.query('SELECT 1 FROM roles WHERE role_name = $1', [roleName]);
    return res.rows.length > 0;
  }

  async permissionExists(permissionName: string): Promise<boolean> {
    const res = await this.pool.query('SELECT 1 FROM permissions WHERE permission_name = $1', [permissionName]);
    return res.rows.length > 0;
  }

  async getPermissionById(permissionId: string): Promise<Permission | null> {
    const res = await this.pool.query('SELECT * FROM permissions WHERE permission_id = $1', [permissionId]);
    return res.rows.length > 0 ? this.mapRowToPermission(res.rows[0]) : null;
  }

  async getPermissionByName(permissionName: string): Promise<Permission | null> {
    const res = await this.pool.query('SELECT * FROM permissions WHERE permission_name = $1', [permissionName]);
    return res.rows.length > 0 ? this.mapRowToPermission(res.rows[0]) : null;
  }

  async getAssignmentByUserAndRole(input: { userId: string; roleId: string }): Promise<UserRole | null> {
    const res = await this.pool.query(
      'SELECT * FROM user_roles WHERE user_id = $1 AND role_id = $2',
      [input.userId, input.roleId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      userRoleId: row.user_role_id,
      userId: row.user_id,
      roleId: row.role_id,
      assignedAt: row.assigned_at.toISOString()
    };
  }

  async getIdempotencyResult(scope: string, key: string): Promise<{ id: string } | null> {
    const res = await this.pool.query('SELECT value FROM idempotency WHERE scope = $1 AND key = $2', [scope, key]);
    return res.rows.length > 0 ? res.rows[0].value : null;
  }

  async setIdempotencyResult(scope: string, key: string, value: { id: string }): Promise<void> {
    await this.pool.query(
      'INSERT INTO idempotency (scope, key, value) VALUES ($1, $2, $3) ON CONFLICT (scope, key) DO UPDATE SET value = EXCLUDED.value',
      [scope, key, JSON.stringify(value)]
    );
  }

  private mapRowToPermission(row: any): Permission {
    return {
      permissionId: row.permission_id,
      permissionName: row.permission_name,
      resource: row.resource,
      action: row.action
    };
  }
}

// Retained for backward compatibility in tests or bootstrap scripts
export { PostgresRbacAdapter as InMemoryRbacPostgresAdapter };
