import { useCallback, useEffect, useState } from 'react';

import {
  HttpReconciliationClient,
  type ReconciliationClient,
  type ReconciliationJobDetail
} from '@/lib/api/reconciliation.client';

export type ReconciliationJobDetailState =
  | { status: 'loading'; error: null }
  | { status: 'success'; error: null }
  | { status: 'error'; error: string };

export type ReconciliationRunState =
  | { status: 'idle'; message: null; error: null }
  | { status: 'submitting'; message: null; error: null }
  | { status: 'success'; message: string; error: null }
  | { status: 'error'; message: null; error: string };

const DEFAULT_CLIENT = new HttpReconciliationClient();

export function useReconciliationJobDetail(
  jobId: string | undefined,
  client: ReconciliationClient = DEFAULT_CLIENT
) {
  const [detail, setDetail] = useState<ReconciliationJobDetail | null>(null);
  const [state, setState] = useState<ReconciliationJobDetailState>({ status: 'loading', error: null });
  const [runState, setRunState] = useState<ReconciliationRunState>({ status: 'idle', message: null, error: null });

  const load = useCallback(async () => {
    if (!jobId || jobId.trim().length < 2) {
      setDetail(null);
      setState({ status: 'error', error: 'invalid_job_id' });
      return;
    }

    setState({ status: 'loading', error: null });

    try {
      const bundle = await client.getJobDetail(jobId);
      setDetail(bundle);
      setState({ status: 'success', error: null });
    } catch (error: unknown) {
      setDetail(null);
      setState({ status: 'error', error: error instanceof Error ? error.message : 'reconciliation_job_detail_failed' });
    }
  }, [client, jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(async () => {
    if (!jobId || jobId.trim().length < 2) {
      setRunState({ status: 'error', message: null, error: 'invalid_job_id' });
      return;
    }

    setRunState({ status: 'submitting', message: null, error: null });

    try {
      const result = await client.runJob(jobId);
      setRunState({
        status: 'success',
        message: `Reconciliation run accepted: ${result.status}.`,
        error: null
      });

      await load();
    } catch (error: unknown) {
      setRunState({
        status: 'error',
        message: null,
        error: error instanceof Error ? error.message : 'reconciliation_job_run_failed'
      });
    }
  }, [client, jobId, load]);

  return {
    detail,
    state,
    runState,
    run,
    reload: load
  };
}
