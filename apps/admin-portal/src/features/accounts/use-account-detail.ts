import { useCallback, useEffect, useState } from 'react';

import { HttpAccountsClient, type AccountDetailBundle, type AccountsClient } from '@/lib/api/accounts.client';

export type AccountDetailState =
  | { status: 'loading'; error: null }
  | { status: 'success'; error: null }
  | { status: 'error'; error: string };

const DEFAULT_CLIENT = new HttpAccountsClient();

export function useAccountDetail(accountId: string | undefined, client: AccountsClient = DEFAULT_CLIENT) {
  const [bundle, setBundle] = useState<AccountDetailBundle | null>(null);
  const [state, setState] = useState<AccountDetailState>({ status: 'loading', error: null });

  const load = useCallback(async () => {
    if (!accountId || accountId.trim().length < 2) {
      setBundle(null);
      setState({ status: 'error', error: 'invalid_account_id' });
      return;
    }

    setState({ status: 'loading', error: null });

    try {
      const detail = await client.getAccountDetail(accountId);
      setBundle(detail);
      setState({ status: 'success', error: null });
    } catch (error: unknown) {
      setBundle(null);
      setState({ status: 'error', error: error instanceof Error ? error.message : 'account_detail_failed' });
    }
  }, [accountId, client]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    bundle,
    state,
    reload: load
  };
}
