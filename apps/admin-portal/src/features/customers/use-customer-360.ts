import { useCallback, useEffect, useState } from 'react';

import { HttpCustomersClient, type Customer360Bundle, type CustomersClient } from '@/lib/api/customers.client';

export type Customer360LoadState =
  | { status: 'loading'; error: null }
  | { status: 'success'; error: null }
  | { status: 'error'; error: string };

const DEFAULT_CLIENT = new HttpCustomersClient();

export function useCustomer360(customerId: string | undefined, client: CustomersClient = DEFAULT_CLIENT) {
  const [bundle, setBundle] = useState<Customer360Bundle | null>(null);
  const [state, setState] = useState<Customer360LoadState>({ status: 'loading', error: null });

  const load = useCallback(async () => {
    if (!customerId || customerId.trim().length < 2) {
      setBundle(null);
      setState({ status: 'error', error: 'invalid_customer_id' });
      return;
    }

    setState({ status: 'loading', error: null });

    try {
      const next = await client.getCustomer360Bundle(customerId);
      setBundle(next);
      setState({ status: 'success', error: null });
    } catch (error: unknown) {
      setBundle(null);
      setState({
        status: 'error',
        error: error instanceof Error ? error.message : 'customer_360_load_failed'
      });
    }
  }, [client, customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    bundle,
    state,
    reload: load
  };
}
