import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageContainer } from '@/components/ui/PageContainer';
import { AccountsFilters } from '@/components/accounts/AccountsFilters';
import { AccountsTable } from '@/components/accounts/AccountsTable';
import { useAccountsList } from '@/features/accounts/use-accounts-list';
import type { AccountsClient } from '@/lib/api/accounts.client';

export type AccountsListPageProps = {
  client?: AccountsClient;
};

export function AccountsListPage({ client }: AccountsListPageProps) {
  const { filters, setFilters, items, state, reload } = useAccountsList(client);

  if (state.status === 'loading') {
    return (
      <PageContainer>
        <LoadingState message="Loading accounts..." />
      </PageContainer>
    );
  }

  if (state.status === 'error') {
    return (
      <PageContainer>
        <ErrorState
          title="Accounts unavailable"
          description={`Unable to load accounts: ${state.error}`}
          onRetry={() => void reload()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>Accounts Investigation</h2>
          <p>Inspect account status, ownership, and activation lifecycle.</p>
        </div>
        <button type="button" className="refresh-button" onClick={() => void reload()}>
          Refresh
        </button>
      </div>

      <AccountsFilters filters={filters} onChange={setFilters} onApply={() => void reload()} />

      {state.status === 'empty' ? (
        <EmptyState title="No accounts found" description="No accounts match the current investigation filters." />
      ) : (
        <AccountsTable items={items} />
      )}
    </PageContainer>
  );
}
