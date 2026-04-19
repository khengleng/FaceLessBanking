import { useLocation } from 'react-router-dom';

import { PageContainer } from '@/components/ui/PageContainer';
import { useAuth } from '@/features/auth/AuthProvider';

export function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();

  const returnTo =
    typeof location.state === 'object' &&
    location.state !== null &&
    'returnTo' in location.state &&
    typeof (location.state as { returnTo?: unknown }).returnTo === 'string'
      ? ((location.state as { returnTo: string }).returnTo || '/dashboard')
      : '/dashboard';

  return (
    <div className="auth-page">
      <PageContainer>
        <div className="auth-card">
          <h2>Admin / Ops Portal Login</h2>
          <p>Authenticate with the internal identity provider to continue.</p>
          <button type="button" onClick={() => void login(returnTo)}>
            Sign In (Keycloak Placeholder)
          </button>
        </div>
      </PageContainer>
    </div>
  );
}
