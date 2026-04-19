import { useCallback, useEffect, useState } from 'react';

import { HttpPaymentsClient, type PaymentDetailBundle, type PaymentsClient } from '@/lib/api/payments.client';

export type PaymentDetailState =
  | { status: 'loading'; error: null }
  | { status: 'success'; error: null }
  | { status: 'error'; error: string };

const DEFAULT_CLIENT = new HttpPaymentsClient();

export function usePaymentDetail(paymentId: string | undefined, client: PaymentsClient = DEFAULT_CLIENT) {
  const [bundle, setBundle] = useState<PaymentDetailBundle | null>(null);
  const [state, setState] = useState<PaymentDetailState>({ status: 'loading', error: null });

  const load = useCallback(async () => {
    if (!paymentId || paymentId.trim().length < 2) {
      setBundle(null);
      setState({ status: 'error', error: 'invalid_payment_id' });
      return;
    }

    setState({ status: 'loading', error: null });

    try {
      const detail = await client.getPaymentDetail(paymentId);
      setBundle(detail);
      setState({ status: 'success', error: null });
    } catch (error: unknown) {
      setBundle(null);
      setState({ status: 'error', error: error instanceof Error ? error.message : 'payment_detail_failed' });
    }
  }, [client, paymentId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    bundle,
    state,
    reload: load
  };
}
