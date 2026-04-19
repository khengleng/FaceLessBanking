import { useCallback, useEffect, useState } from 'react';

import { HttpAccountsClient, type AccountFilters, type AccountListItem, type AccountsClient } from '@/lib/api/accounts.client';

export type AccountsListState =
  | { status: 'loading'; error: null }
  | { status: 'success'; error: null }
  | { status: 'empty'; error: null }
  | { status: 'error'; error: string };

export type AccountsFiltersState = {
  status: string;
  accountType: string;
  customerId: string;
};

const DEFAULT_CLIENT = new HttpAccountsClient();

export function useAccountsList(client: AccountsClient = DEFAULT_CLIENT) {
  const [filters, setFilters] = useState<AccountsFiltersState>({
    status: 'ALL',
    accountType: 'ALL',
    customerId: ''
  });
  const [items, setItems] = useState<AccountListItem[]>([]);
  const [state, setState] = useState<AccountsListState>({ status: 'loading', error: null });

  const load = useCallback(async () => {
    setState({ status: 'loading', error: null });

    try {
      const query: AccountFilters = {
        status: filters.status,
        accountType: filters.accountType,
        customerId: filters.customerId.trim() || undefined,
        limit: 25,
        offset: 0
      };

      const response = await client.listAccounts(query);
      setItems(response.items);

      if (response.items.length === 0) {
        setState({ status: 'empty', error: null });
        return;
      }

      setState({ status: 'success', error: null });
    } catch (error: unknown) {
      setItems([]);
      setState({ status: 'error', error: error instanceof Error ? error.message : 'accounts_list_failed' });
    }
  }, [client, filters.accountType, filters.customerId, filters.status]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    filters,
    setFilters,
    items,
    state,
    reload: load
  };
}
