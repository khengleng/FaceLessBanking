import type { LoanReviewAction } from '@/lib/api/loans.client';

export type LoanReviewControlsProps = {
  enabled: boolean;
  actionState: {
    status: 'idle' | 'submitting' | 'success' | 'error';
    message: string | null;
    error: string | null;
  };
  onAction: (action: LoanReviewAction) => Promise<void>;
};

export function LoanReviewControls({ enabled, actionState, onAction }: LoanReviewControlsProps) {
  const applyAction = async (action: LoanReviewAction) => {
    if (!enabled) {
      return;
    }

    if ((action === 'REJECT' || action === 'HOLD') && !window.confirm(`Confirm ${action.toLowerCase()} for this loan review case?`)) {
      return;
    }

    await onAction(action);
  };

  return (
    <section className="loan-review-controls" aria-label="loan review controls">
      <h3>Review Controls</h3>
      <div className="loan-review-actions">
        <button type="button" onClick={() => void applyAction('APPROVE')} disabled={!enabled || actionState.status === 'submitting'}>
          Approve
        </button>
        <button type="button" onClick={() => void applyAction('REJECT')} disabled={!enabled || actionState.status === 'submitting'}>
          Reject
        </button>
        <button type="button" onClick={() => void applyAction('HOLD')} disabled={!enabled || actionState.status === 'submitting'}>
          Hold
        </button>
      </div>

      {!enabled ? <p className="panel-placeholder">Loan review actions are unavailable for this record.</p> : null}
      {actionState.status === 'success' ? <p className="action-success">{actionState.message}</p> : null}
      {actionState.status === 'error' ? <p className="action-error">{actionState.error}</p> : null}
    </section>
  );
}
