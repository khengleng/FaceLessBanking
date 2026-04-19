import { useCallback, useEffect, useState } from 'react';

import {
  HttpReconciliationClient,
  type ReconciliationClient,
  type ReconciliationJob,
  type ReconciliationJobType
} from '@/lib/api/reconciliation.client';

export type ReconciliationJobsState =
  | { status: 'loading'; error: null }
  | { status: 'success'; error: null }
  | { status: 'empty'; error: null }
  | { status: 'error'; error: string };

export type CreateJobState =
  | { status: 'idle'; message: null; error: null }
  | { status: 'submitting'; message: null; error: null }
  | { status: 'success'; message: string; error: null }
  | { status: 'error'; message: null; error: string };

const DEFAULT_CLIENT = new HttpReconciliationClient();

export function useReconciliationJobs(client: ReconciliationClient = DEFAULT_CLIENT) {
  const [items, setItems] = useState<ReconciliationJob[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [state, setState] = useState<ReconciliationJobsState>({ status: 'loading', error: null });
  const [createState, setCreateState] = useState<CreateJobState>({ status: 'idle', message: null, error: null });

  const load = useCallback(async () => {
    setState({ status: 'loading', error: null });

    try {
      const response = await client.listJobs(25, 0);
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
      setState({ status: 'error', error: error instanceof Error ? error.message : 'reconciliation_jobs_failed' });
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const createJob = useCallback(
    async (jobType: ReconciliationJobType) => {
      setCreateState({ status: 'submitting', message: null, error: null });

      try {
        const created = await client.createJob(jobType);

        setItems((current) => {
          const next = [created, ...current.filter((item) => item.jobId !== created.jobId)];
          return next;
        });

        setState({ status: 'success', error: null });
        setCreateState({
          status: 'success',
          message: `Reconciliation job ${created.jobId} created.`,
          error: null
        });
      } catch (error: unknown) {
        setCreateState({
          status: 'error',
          message: null,
          error: error instanceof Error ? error.message : 'reconciliation_job_create_failed'
        });
      }
    },
    [client]
  );

  return {
    items,
    warnings,
    state,
    createState,
    createJob,
    reload: load
  };
}
