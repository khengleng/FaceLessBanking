import { useCallback, useEffect, useState } from 'react';

import { HttpCustomersClient, type CustomerFilters, type CustomerListItem, type CustomersClient } from '@/lib/api/customers.client';

export type CustomerListLoadState =
  | { status: 'loading'; error: null }
  | { status: 'success'; error: null }
  | { status: 'empty'; error: null }
  | { status: 'error'; error: string };

export type CustomerListFilters = {
  customerId: string;
  onboardingReference: string;
};

const DEFAULT_CLIENT = new HttpCustomersClient();

export function useCustomerList(client: CustomersClient = DEFAULT_CLIENT) {
  const [filters, setFilters] = useState<CustomerListFilters>({
    customerId: '',
    onboardingReference: ''
  });
  const [items, setItems] = useState<CustomerListItem[]>([]);
  const [state, setState] = useState<CustomerListLoadState>({ status: 'loading', error: null });

  const load = useCallback(async () => {
    setState({ status: 'loading', error: null });

    try {
      const query: CustomerFilters = {
        customerId: filters.customerId.trim() || undefined,
        onboardingReference: filters.onboardingReference.trim() || undefined,
        limit: 25,
        offset: 0
      };

      const response = await client.listCustomers(query);
      setItems(response.items);

      if (response.items.length === 0) {
        setState({ status: 'empty', error: null });
        return;
      }

      setState({ status: 'success', error: null });
    } catch (error: unknown) {
      setItems([]);
      setState({
        status: 'error',
        error: error instanceof Error ? error.message : 'customer_list_load_failed'
      });
    }
  }, [client, filters.customerId, filters.onboardingReference]);

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
