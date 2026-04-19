import { useMemo } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import type { AuthSessionAdapter } from '@/features/auth/session';
import { getNavigationForRoles } from '@/features/navigation/navigation';
import { LoginPage } from '@/pages/LoginPage';
import { UnauthorizedPage } from '@/pages/UnauthorizedPage';

import { PORTAL_ROUTES } from './routes';

type AppRoutesProps = {
  authAdapter?: AuthSessionAdapter;
};

function PortalLayout() {
  const { session, logout } = useAuth();

  if (!session) {
    return null;
  }

  const navItems = getNavigationForRoles(session.roles);

  return (
    <AppShell session={session} navItems={navItems}>
      <button type="button" className="logout-button" onClick={() => void logout()}>
        Logout
      </button>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        {PORTAL_ROUTES.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={<ProtectedRoute requiredRoles={route.requiredRoles}>{route.element}</ProtectedRoute>}
          />
        ))}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  );
}

function AppRoutes() {
  const { status } = useAuth();
  const loading = useMemo(() => status === 'bootstrapping', [status]);

  if (loading) {
    return <div className="loading-view">Loading session...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <PortalLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export function App({ authAdapter }: AppRoutesProps) {
  return (
    <AuthProvider adapter={authAdapter}>
      <AppRoutes />
    </AuthProvider>
  );
}
