import { Navigate, useLocation } from 'react-router-dom';
import type { PropsWithChildren } from 'react';

import { useAuth } from './AuthProvider';
import { hasAnyRequiredRole } from './permission-guard';
import type { UserRole } from './session';

export type ProtectedRouteProps = PropsWithChildren<{
  requiredRoles?: UserRole[];
}>;

export function ProtectedRoute({ requiredRoles = [], children }: ProtectedRouteProps) {
  const { status, session } = useAuth();
  const location = useLocation();

  if (status === 'bootstrapping') {
    return <div className="loading-view">Loading session...</div>;
  }

  if (status !== 'authenticated' || !session) {
    return <Navigate to="/login" replace state={{ returnTo: location.pathname }} />;
  }

  if (requiredRoles.length > 0 && !hasAnyRequiredRole(session.roles, requiredRoles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
