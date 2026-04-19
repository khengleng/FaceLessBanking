import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  HttpWorkflowCasesClient,
  type OnboardingCase,
  type OnboardingCaseAction,
  type OnboardingCaseDetail,
  type OnboardingCaseFilters,
  type OnboardingCaseStatus,
  type WorkflowCasesClient
} from '@/lib/api/workflow-cases.client';

export type QueueLoadState =
  | { status: 'loading'; error: null }
  | { status: 'success'; error: null }
  | { status: 'empty'; error: null }
  | { status: 'error'; error: string };

export type ActionState =
  | { status: 'idle'; message: null; error: null }
  | { status: 'submitting'; message: null; error: null }
  | { status: 'success'; message: string; error: null }
  | { status: 'error'; message: null; error: string };

export type OnboardingFiltersState = {
  status: OnboardingCaseStatus | 'ALL';
  entityId: string;
  dateFrom: string;
  dateTo: string;
};

export const DEFAULT_FILTERS: OnboardingFiltersState = {
  status: 'ALL',
  entityId: '',
  dateFrom: '',
  dateTo: ''
};

const DEFAULT_CLIENT = new HttpWorkflowCasesClient();

export function useOnboardingReviewQueue(client: WorkflowCasesClient = DEFAULT_CLIENT) {
  const [filters, setFilters] = useState<OnboardingFiltersState>(DEFAULT_FILTERS);
  const [cases, setCases] = useState<OnboardingCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<OnboardingCaseDetail | null>(null);
  const [queueState, setQueueState] = useState<QueueLoadState>({ status: 'loading', error: null });
  const [detailState, setDetailState] = useState<QueueLoadState>({ status: 'loading', error: null });
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle', message: null, error: null });

  const loadCases = useCallback(async () => {
    setQueueState({ status: 'loading', error: null });

    try {
      const queryFilters: OnboardingCaseFilters = {
        status: filters.status,
        entityId: filters.entityId.trim() || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        limit: 25,
        offset: 0
      };
      const response = await client.listOnboardingCases(queryFilters);
      setCases(response.items);

      if (response.items.length === 0) {
        setSelectedCaseId(null);
        setSelectedCase(null);
        setQueueState({ status: 'empty', error: null });
        return;
      }

      setSelectedCaseId((currentSelectedCaseId) => {
        const selectedExists = currentSelectedCaseId
          ? response.items.some((item) => item.caseId === currentSelectedCaseId)
          : false;
        return selectedExists ? currentSelectedCaseId : response.items[0].caseId;
      });
      setQueueState({ status: 'success', error: null });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'case_list_load_failed';
      setCases([]);
      setSelectedCaseId(null);
      setSelectedCase(null);
      setQueueState({ status: 'error', error: message });
    }
  }, [client, filters.dateFrom, filters.dateTo, filters.entityId, filters.status]);

  const loadCaseDetail = useCallback(async () => {
    if (!selectedCaseId) {
      setSelectedCase(null);
      setDetailState({ status: 'empty', error: null });
      return;
    }

    setDetailState({ status: 'loading', error: null });

    try {
      const detail = await client.getCaseById(selectedCaseId);
      setSelectedCase(detail);
      setDetailState({ status: 'success', error: null });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'case_detail_load_failed';
      setSelectedCase(null);
      setDetailState({ status: 'error', error: message });
    }
  }, [client, selectedCaseId]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  useEffect(() => {
    void loadCaseDetail();
  }, [loadCaseDetail]);

  const applyAction = useCallback(
    async (actionType: OnboardingCaseAction, reason?: string) => {
      if (!selectedCaseId) {
        setActionState({ status: 'error', message: null, error: 'No case selected.' });
        return;
      }

      setActionState({ status: 'submitting', message: null, error: null });

      try {
        const updated = await client.applyCaseAction(selectedCaseId, actionType, reason);
        setSelectedCase(updated);
        setCases((current) =>
          current.map((item) =>
            item.caseId === updated.caseId
              ? {
                  ...item,
                  status: updated.status,
                  updatedAt: updated.updatedAt
                }
              : item
          )
        );
        setActionState({
          status: 'success',
          message: `Case ${updated.caseId} updated to ${updated.status}.`,
          error: null
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'case_action_failed';
        setActionState({ status: 'error', message: null, error: message });
      }
    },
    [client, selectedCaseId]
  );

  const selection = useMemo(
    () => ({
      selectedCaseId,
      selectedCase,
      setSelectedCaseId
    }),
    [selectedCase, selectedCaseId]
  );

  return {
    filters,
    setFilters,
    cases,
    queueState,
    detailState,
    actionState,
    selection,
    reloadCases: loadCases,
    applyAction
  };
}
