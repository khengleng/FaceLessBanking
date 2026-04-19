import { Link, useParams } from 'react-router-dom';

import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { LoanDetailPanel } from '@/components/loans/LoanDetailPanel';
import { PageContainer } from '@/components/ui/PageContainer';
import { useAuth } from '@/features/auth/AuthProvider';
import { useLoanDetail } from '@/features/loans/use-loan-detail';
import type { LoansClient } from '@/lib/api/loans.client';

export type LoanDetailPageProps = {
  client?: LoansClient;
};

export function LoanDetailPage({ client }: LoanDetailPageProps) {
  const { loanId } = useParams<{ loanId: string }>();
  const { session } = useAuth();
  const { bundle, state, actionState, applyAction, reload } = useLoanDetail(loanId, client);

  if (state.status === 'loading') {
    return (
      <PageContainer>
        <LoadingState message="Loading loan detail..." />
      </PageContainer>
    );
  }

  if (state.status === 'error' || !bundle) {
    return (
      <PageContainer>
        <div className="page-header">
          <div>
            <h2>Loan Investigation</h2>
            <p>Loan application and approval workflow investigation.</p>
          </div>
          <Link to="/loans" className="link-button">Back to Loans</Link>
        </div>

        <ErrorState
          title="Loan detail unavailable"
          description={`Unable to load loan detail: ${state.error ?? 'loan_detail_unavailable'}`}
          onRetry={() => void reload()}
        />
      </PageContainer>
    );
  }

  const reviewEnabled = Boolean(session?.roles.some((role) => role === 'OPS_MANAGER' || role === 'ADMIN_USER'));

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>{bundle.loan.loanId}</h2>
          <p>{bundle.loan.customerId}</p>
        </div>
        <div className="header-actions">
          <button type="button" className="refresh-button" onClick={() => void reload()}>
            Refresh
          </button>
          <Link to="/loans" className="link-button">Back</Link>
        </div>
      </div>

      {!reviewEnabled ? (
        <div className="warning-banner" role="status">
          Your role has read-only access for loan reviews.
        </div>
      ) : null}

      {bundle.warnings.length > 0 ? (
        <div className="warning-banner" role="status">
          Some loan detail sources are partial: {bundle.warnings.join(', ')}
        </div>
      ) : null}

      <LoanDetailPanel
        bundle={bundle}
        reviewEnabled={reviewEnabled}
        actionState={actionState}
        onReviewAction={applyAction}
      />
    </PageContainer>
  );
}
