import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageContainer } from '@/components/ui/PageContainer';
import { PaymentsFilters } from '@/components/payments/PaymentsFilters';
import { PaymentsTable } from '@/components/payments/PaymentsTable';
import { usePaymentsList } from '@/features/payments/use-payments-list';
import type { PaymentsClient } from '@/lib/api/payments.client';

export type PaymentsListPageProps = {
  client?: PaymentsClient;
};

export function PaymentsListPage({ client }: PaymentsListPageProps) {
  const { filters, setFilters, items, state, reload } = usePaymentsList(client);

  if (state.status === 'loading') {
    return (
      <PageContainer>
        <LoadingState message="Loading payments..." />
      </PageContainer>
    );
  }

  if (state.status === 'error') {
    return (
      <PageContainer>
        <ErrorState
          title="Payments unavailable"
          description={`Unable to load payments: ${state.error}`}
          onRetry={() => void reload()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>Payments Investigation</h2>
          <p>Investigate payment lifecycle, failures, and correlated events.</p>
        </div>
        <button type="button" className="refresh-button" onClick={() => void reload()}>
          Refresh
        </button>
      </div>

      <PaymentsFilters filters={filters} onChange={setFilters} onApply={() => void reload()} />

      {state.status === 'empty' ? (
        <EmptyState title="No payments found" description="No payments match the selected investigation filters." />
      ) : (
        <PaymentsTable items={items} />
      )}
    </PageContainer>
  );
}
