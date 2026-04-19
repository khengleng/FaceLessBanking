import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  HttpOpsDashboardClient,
  type DashboardSnapshot,
  type OpsDashboardClient
} from '@/lib/api/ops-dashboard.client';

export type DashboardLoadState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: DashboardSnapshot; error: null }
  | { status: 'empty'; data: DashboardSnapshot; error: null }
  | { status: 'error'; data: null; error: string };

const DEFAULT_EMPTY_SNAPSHOT: DashboardSnapshot = {
  onboardingPending: 0,
  paymentsFailed: 0,
  loansInReview: 0,
  openDisputes: 0,
  reconciliationMismatches: 0,
  liquiditySummary: {
    availableLiquidity: 0,
    currency: 'USD',
    source: 'liquidity.summary.placeholder'
  },
  recentActivity: [],
  alerts: []
};

const DEFAULT_DASHBOARD_CLIENT = new HttpOpsDashboardClient();

export function useDashboardSnapshot(client: OpsDashboardClient = DEFAULT_DASHBOARD_CLIENT) {
  const [state, setState] = useState<DashboardLoadState>({
    status: 'loading',
    data: null,
    error: null
  });

  const load = useCallback(async () => {
    setState({ status: 'loading', data: null, error: null });

    try {
      const data = await client.loadSnapshot();
      const isEmpty =
        data.onboardingPending === 0 &&
        data.paymentsFailed === 0 &&
        data.loansInReview === 0 &&
        data.openDisputes === 0 &&
        data.reconciliationMismatches === 0 &&
        data.recentActivity.length === 0 &&
        data.alerts.length === 0;

      if (isEmpty) {
        setState({ status: 'empty', data, error: null });
        return;
      }

      setState({ status: 'success', data, error: null });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'dashboard_load_failed';
      setState({ status: 'error', data: null, error: message });
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const snapshot = useMemo(() => state.data ?? DEFAULT_EMPTY_SNAPSHOT, [state.data]);

  return {
    state,
    snapshot,
    reload: load
  };
}
