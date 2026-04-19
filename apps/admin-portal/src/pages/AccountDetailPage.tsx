import { Link, useParams } from 'react-router-dom';

import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageContainer } from '@/components/ui/PageContainer';
import { AccountDetailPanel } from '@/components/accounts/AccountDetailPanel';
import { useAccountDetail } from '@/features/accounts/use-account-detail';
import type { AccountsClient } from '@/lib/api/accounts.client';

export type AccountDetailPageProps = {
  client?: AccountsClient;
};

export function AccountDetailPage({ client }: AccountDetailPageProps) {
  const { accountId } = useParams<{ accountId: string }>();
  const { bundle, state, reload } = useAccountDetail(accountId, client);

  if (state.status === 'loading') {
    return (
      <PageContainer>
        <LoadingState message="Loading account detail..." />
      </PageContainer>
    );
  }

  if (state.status === 'error' || !bundle) {
    return (
      <PageContainer>
        <div className="page-header">
          <div>
            <h2>Account Investigation</h2>
            <p>Safe operational account detail lookup.</p>
          </div>
          <Link to="/accounts" className="link-button">Back to Accounts</Link>
        </div>
        <ErrorState
          title="Account detail unavailable"
          description={`Unable to load account: ${state.error ?? 'account_detail_unavailable'}`}
          onRetry={() => void reload()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>{bundle.account.accountId}</h2>
          <p>{bundle.account.customerId}</p>
        </div>
        <div className="header-actions">
          <button type="button" className="refresh-button" onClick={() => void reload()}>
            Refresh
          </button>
          <Link to="/accounts" className="link-button">Back</Link>
        </div>
      </div>

      {bundle.warnings.length > 0 ? (
        <div className="warning-banner" role="status">
          Some data is partial: {bundle.warnings.join(', ')}
        </div>
      ) : null}

      <AccountDetailPanel bundle={bundle} />
    </PageContainer>
  );
}
