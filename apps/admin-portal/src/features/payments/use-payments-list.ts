import { useCallback, useEffect, useState } from 'react';

import { HttpPaymentsClient, type PaymentFilters, type PaymentItem, type PaymentsClient } from '@/lib/api/payments.client';

export type PaymentsListState =
  | { status: 'loading'; error: null }
  | { status: 'success'; error: null }
  | { status: 'empty'; error: null }
  | { status: 'error'; error: string };

export type PaymentsFiltersState = {
  status: string;
  dateFrom: string;
  dateTo: string;
  accountId: string;
  correlationId: string;
};

const DEFAULT_CLIENT = new HttpPaymentsClient();

export function usePaymentsList(client: PaymentsClient = DEFAULT_CLIENT) {
  const [filters, setFilters] = useState<PaymentsFiltersState>({
    status: 'ALL',
    dateFrom: '',
    dateTo: '',
    accountId: '',
    correlationId: ''
  });
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [state, setState] = useState<PaymentsListState>({ status: 'loading', error: null });

  const load = useCallback(async () => {
    setState({ status: 'loading', error: null });

    try {
      const query: PaymentFilters = {
        status: filters.status,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        accountId: filters.accountId.trim() || undefined,
        correlationId: filters.correlationId.trim() || undefined,
        limit: 25,
        offset: 0
      };

      const response = await client.listPayments(query);
      setItems(response.items);

      if (response.items.length === 0) {
        setState({ status: 'empty', error: null });
        return;
      }

      setState({ status: 'success', error: null });
    } catch (error: unknown) {
      setItems([]);
      setState({ status: 'error', error: error instanceof Error ? error.message : 'payments_list_failed' });
    }
  }, [client, filters.accountId, filters.correlationId, filters.dateFrom, filters.dateTo, filters.status]);

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
