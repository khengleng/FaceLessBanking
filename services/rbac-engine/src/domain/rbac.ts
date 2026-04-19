export type Permission = string;

export interface Role {
  roleId: string;
  name: string;
  permissions: Permission[];
  createdAt: string;
}

export interface UserRole {
  userId: string;
  roleId: string;
  assignedAt: string;
}

export interface CreateRoleInput {
  name: string;
  permissions: Permission[];
}

export interface AssignRoleInput {
  userId: string;
  roleId: string;
}

export const RBAC_PERMISSIONS = {
  CREATE_ROLE: 'rbac.roles.create',
  ASSIGN_ROLE: 'rbac.roles.assign'
} as const;
