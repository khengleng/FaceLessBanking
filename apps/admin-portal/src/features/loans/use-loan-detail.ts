import { useCallback, useEffect, useState } from 'react';

import {
  HttpLoansClient,
  type LoanDetailBundle,
  type LoanReviewAction,
  type LoansClient
} from '@/lib/api/loans.client';

export type LoanDetailState =
  | { status: 'loading'; error: null }
  | { status: 'success'; error: null }
  | { status: 'error'; error: string };

export type LoanActionState =
  | { status: 'idle'; message: null; error: null }
  | { status: 'submitting'; message: null; error: null }
  | { status: 'success'; message: string; error: null }
  | { status: 'error'; message: null; error: string };

const DEFAULT_CLIENT = new HttpLoansClient();

export function useLoanDetail(loanId: string | undefined, client: LoansClient = DEFAULT_CLIENT) {
  const [bundle, setBundle] = useState<LoanDetailBundle | null>(null);
  const [state, setState] = useState<LoanDetailState>({ status: 'loading', error: null });
  const [actionState, setActionState] = useState<LoanActionState>({
    status: 'idle',
    message: null,
    error: null
  });

  const load = useCallback(async () => {
    if (!loanId || loanId.trim().length < 2) {
      setBundle(null);
      setState({ status: 'error', error: 'invalid_loan_id' });
      return;
    }

    setState({ status: 'loading', error: null });

    try {
      const detail = await client.getLoanDetail(loanId);
      setBundle(detail);
      setState({ status: 'success', error: null });
      setActionState((current) => (current.status === 'success' ? current : { status: 'idle', message: null, error: null }));
    } catch (error: unknown) {
      setBundle(null);
      setState({ status: 'error', error: error instanceof Error ? error.message : 'loan_detail_failed' });
    }
  }, [client, loanId]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyAction = useCallback(
    async (action: LoanReviewAction, reason?: string) => {
      if (!bundle?.workflowCase?.caseId) {
        setActionState({ status: 'error', message: null, error: 'loan_review_case_unavailable' });
        return;
      }

      setActionState({ status: 'submitting', message: null, error: null });

      try {
        const updated = await client.applyLoanReviewAction(bundle.workflowCase.caseId, action, reason);
        setBundle({
          ...bundle,
          workflowCase: updated,
          loan: {
            ...bundle.loan,
            approvalWorkflowState: updated.status,
            workflowCaseId: updated.caseId
          }
        });

        setActionState({
          status: 'success',
          message: `Loan review case ${updated.caseId} updated to ${updated.status}.`,
          error: null
        });
      } catch (error: unknown) {
        setActionState({
          status: 'error',
          message: null,
          error: error instanceof Error ? error.message : 'loan_action_failed'
        });
      }
    },
    [bundle, client]
  );

  return {
    bundle,
    state,
    actionState,
    applyAction,
    reload: load
  };
}
