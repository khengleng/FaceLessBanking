import { Link, useParams } from 'react-router-dom';

import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageContainer } from '@/components/ui/PageContainer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Customer360Tabs } from '@/components/customers/Customer360Tabs';
import { useCustomer360 } from '@/features/customers/use-customer-360';
import type { CustomersClient } from '@/lib/api/customers.client';

export type Customer360PageProps = {
  client?: CustomersClient;
};

export function Customer360Page({ client }: Customer360PageProps) {
  const { customerId } = useParams<{ customerId: string }>();
  const { bundle, state, reload } = useCustomer360(customerId, client);

  if (state.status === 'loading') {
    return (
      <PageContainer>
        <LoadingState message="Loading customer 360 view..." />
      </PageContainer>
    );
  }

  if (state.status === 'error' || !bundle) {
    return (
      <PageContainer>
        <div className="page-header">
          <div>
            <h2>Customer 360</h2>
            <p>Unified customer context for operations.</p>
          </div>
          <Link to="/customers" className="link-button">
            Back to Customers
          </Link>
        </div>

        <ErrorState
          title="Customer 360 unavailable"
          description={`Unable to load customer context: ${state.error ?? 'customer_360_unavailable'}`}
          onRetry={() => void reload()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>{bundle.customer.firstName} {bundle.customer.lastName}</h2>
          <p>{bundle.customer.customerId}</p>
        </div>
        <div className="header-actions">
          <StatusBadge label={bundle.customer.status} />
          <button type="button" className="refresh-button" onClick={() => void reload()}>
            Refresh
          </button>
          <Link to="/customers" className="link-button">
            Back
          </Link>
        </div>
      </div>

      {bundle.warnings.length > 0 ? (
        <div className="warning-banner" role="status">
          Some sections are partial: {bundle.warnings.join(', ')}
        </div>
      ) : null}

      <section className="summary-grid" aria-label="customer 360 summary">
        <article className="summary-card">
          <h3>Accounts</h3>
          <p className="summary-card-value">{bundle.accounts.length}</p>
        </article>
        <article className="summary-card">
          <h3>Loans</h3>
          <p className="summary-card-value">{bundle.loans.length}</p>
        </article>
        <article className="summary-card">
          <h3>Verification</h3>
          <p className="summary-card-value">{bundle.profile?.verificationStatus ?? 'UNVERIFIED'}</p>
        </article>
      </section>

      <Customer360Tabs bundle={bundle} />
    </PageContainer>
  );
}
