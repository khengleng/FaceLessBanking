export interface Role {
  roleId: string;
  roleName: string;
  description: string;
}

export interface Permission {
  permissionId: string;
  permissionName: string;
  resource: string;
  action: string;
}

export interface UserRole {
  userRoleId: string;
  userId: string;
  roleId: string;
  assignedAt: string;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export const RBAC_MANAGEMENT_PERMISSIONS = {
  ROLE_CREATE: 'rbac.roles.create',
  PERMISSION_CREATE: 'rbac.permissions.create',
  ROLE_ASSIGN: 'rbac.roles.assign'
} as const;

export const RBAC_ADMIN_ROLE_NAME = 'RBAC_ADMIN';
