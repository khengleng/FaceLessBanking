import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/ui/EmptyState';
import { PageContainer } from '@/components/ui/PageContainer';

export function UnauthorizedPage() {
  return (
    <div className="auth-page">
      <PageContainer>
        <EmptyState
          title="Access blocked"
          description="You do not have permission to access this page. Contact an administrator if this seems incorrect."
        />
        <p>
          <Link to="/dashboard">Return to Dashboard</Link>
        </p>
      </PageContainer>
    </div>
  );
}
