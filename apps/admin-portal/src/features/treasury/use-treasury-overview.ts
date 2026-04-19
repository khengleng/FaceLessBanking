import { useCallback, useEffect, useState } from 'react';

import { HttpTreasuryClient, type TreasuryClient, type TreasuryOverview } from '@/lib/api/treasury.client';

export type TreasuryLoadState =
  | { status: 'loading'; error: null }
  | { status: 'success'; error: null }
  | { status: 'empty'; error: null }
  | { status: 'error'; error: string };

const DEFAULT_CLIENT = new HttpTreasuryClient();

export function useTreasuryOverview(client: TreasuryClient = DEFAULT_CLIENT) {
  const [currency, setCurrency] = useState('ALL');
  const [overview, setOverview] = useState<TreasuryOverview | null>(null);
  const [state, setState] = useState<TreasuryLoadState>({ status: 'loading', error: null });

  const load = useCallback(async () => {
    setState({ status: 'loading', error: null });

    try {
      const data = await client.getOverview(currency === 'ALL' ? undefined : currency);
      setOverview(data);

      const hasData =
        data.liquidityPositions.length > 0
        || data.treasuryAccounts.length > 0
        || data.maturityBuckets.length > 0
        || data.repricingGaps.length > 0
        || data.almSummary !== null;

      if (!hasData) {
        setState({ status: 'empty', error: null });
        return;
      }

      setState({ status: 'success', error: null });
    } catch (error: unknown) {
      setOverview(null);
      setState({
        status: 'error',
        error: error instanceof Error ? error.message : 'treasury_overview_failed'
      });
    }
  }, [client, currency]);

  useEffect(() => {
    void load();
  }, [load]);

  const currencies = deriveCurrencies(overview);

  return {
    currency,
    setCurrency,
    overview,
    state,
    currencies,
    reload: load
  };
}

function deriveCurrencies(overview: TreasuryOverview | null): string[] {
  if (!overview) {
    return [];
  }

  const set = new Set<string>();

  for (const item of overview.liquidityPositions) {
    set.add(item.currency);
  }

  for (const item of overview.treasuryAccounts) {
    set.add(item.currency);
  }

  for (const item of overview.maturityBuckets) {
    set.add(item.currency);
  }

  return Array.from(set).sort();
}
