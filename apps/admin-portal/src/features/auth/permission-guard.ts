import type { AuthSession, UserRole } from './session';

export function hasAnyRequiredRole(userRoles: UserRole[], requiredRoles: UserRole[]): boolean {
  if (requiredRoles.length === 0) {
    return true;
  }

  return requiredRoles.some((role) => userRoles.includes(role));
}

export function canAccessSession(
  session: AuthSession | null,
  requiredRoles: UserRole[] = []
): boolean {
  if (!session) {
    return false;
  }

  return hasAnyRequiredRole(session.roles, requiredRoles);
}
