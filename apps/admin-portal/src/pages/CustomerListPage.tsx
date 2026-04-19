import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageContainer } from '@/components/ui/PageContainer';
import { CustomerListFilters } from '@/components/customers/CustomerListFilters';
import { CustomerListTable } from '@/components/customers/CustomerListTable';
import { useCustomerList } from '@/features/customers/use-customer-list';
import type { CustomersClient } from '@/lib/api/customers.client';

export type CustomerListPageProps = {
  client?: CustomersClient;
};

export function CustomerListPage({ client }: CustomerListPageProps) {
  const { filters, setFilters, items, state, reload } = useCustomerList(client);

  if (state.status === 'loading') {
    return (
      <PageContainer>
        <LoadingState message="Loading customers..." />
      </PageContainer>
    );
  }

  if (state.status === 'error') {
    return (
      <PageContainer>
        <ErrorState
          title="Customer list unavailable"
          description={`Unable to load customers: ${state.error}`}
          onRetry={() => void reload()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>Customers</h2>
          <p>Search and open unified customer operations view.</p>
        </div>
        <button type="button" className="refresh-button" onClick={() => void reload()}>
          Refresh
        </button>
      </div>

      <CustomerListFilters filters={filters} onChange={setFilters} onApply={() => void reload()} />

      {state.status === 'empty' ? (
        <EmptyState title="No customers found" description="No customer records match the current search filters." />
      ) : (
        <CustomerListTable items={items} />
      )}
    </PageContainer>
  );
}
