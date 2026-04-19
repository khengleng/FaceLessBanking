import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { LoansFilters } from '@/components/loans/LoansFilters';
import { LoansTable } from '@/components/loans/LoansTable';
import { PageContainer } from '@/components/ui/PageContainer';
import { useLoansList } from '@/features/loans/use-loans-list';
import type { LoansClient } from '@/lib/api/loans.client';

export type LoansListPageProps = {
  client?: LoansClient;
};

export function LoansListPage({ client }: LoansListPageProps) {
  const { filters, setFilters, items, warnings, state, reload } = useLoansList(client);

  if (state.status === 'loading') {
    return (
      <PageContainer>
        <LoadingState message="Loading loans..." />
      </PageContainer>
    );
  }

  if (state.status === 'error') {
    return (
      <PageContainer>
        <ErrorState
          title="Loans unavailable"
          description={`Unable to load loans: ${state.error}`}
          onRetry={() => void reload()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>Loans Review & Investigation</h2>
          <p>Inspect loan applications, workflow outcomes, and account servicing state.</p>
        </div>
        <button type="button" className="refresh-button" onClick={() => void reload()}>
          Refresh
        </button>
      </div>

      <LoansFilters filters={filters} onChange={setFilters} onApply={() => void reload()} />

      {warnings.length > 0 ? (
        <div className="warning-banner" role="status">
          Some loan list sources are partial: {warnings.join(', ')}
        </div>
      ) : null}

      {state.status === 'empty' ? (
        <EmptyState
          title="No loans found"
          description="No loans match the current filters. Provide loanAccountId for direct lookup when list indexing is not available."
        />
      ) : (
        <LoansTable items={items} />
      )}
    </PageContainer>
  );
}
