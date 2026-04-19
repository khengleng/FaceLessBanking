import { useCallback, useEffect, useState } from 'react';

import { HttpLoansClient, type LoanFilters, type LoanItem, type LoansClient } from '@/lib/api/loans.client';

export type LoansListState =
  | { status: 'loading'; error: null }
  | { status: 'success'; error: null }
  | { status: 'empty'; error: null }
  | { status: 'error'; error: string };

export type LoanFiltersState = {
  status: string;
  customerId: string;
  loanAccountId: string;
};

const DEFAULT_CLIENT = new HttpLoansClient();

export function useLoansList(client: LoansClient = DEFAULT_CLIENT) {
  const [filters, setFilters] = useState<LoanFiltersState>({
    status: 'ALL',
    customerId: '',
    loanAccountId: ''
  });
  const [items, setItems] = useState<LoanItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [state, setState] = useState<LoansListState>({ status: 'loading', error: null });

  const load = useCallback(async () => {
    setState({ status: 'loading', error: null });

    try {
      const query: LoanFilters = {
        status: filters.status,
        customerId: filters.customerId.trim() || undefined,
        loanAccountId: filters.loanAccountId.trim() || undefined,
        limit: 25,
        offset: 0
      };

      const response = await client.listLoans(query);
      setItems(response.items);
      setWarnings(response.warnings);

      if (response.items.length === 0) {
        setState({ status: 'empty', error: null });
        return;
      }

      setState({ status: 'success', error: null });
    } catch (error: unknown) {
      setItems([]);
      setWarnings([]);
      setState({ status: 'error', error: error instanceof Error ? error.message : 'loans_list_failed' });
    }
  }, [client, filters.customerId, filters.loanAccountId, filters.status]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    filters,
    setFilters,
    items,
    warnings,
    state,
    reload: load
  };
}
