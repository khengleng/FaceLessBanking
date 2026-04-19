import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import type { OnboardingCaseAction, OnboardingCaseDetail } from '@/lib/api/workflow-cases.client';

export type OnboardingCaseDetailPanelProps = {
  item: OnboardingCaseDetail | null;
  actionStatus: {
    status: 'idle' | 'submitting' | 'success' | 'error';
    message: string | null;
    error: string | null;
  };
  onAction: (action: OnboardingCaseAction, reason?: string) => Promise<void>;
};

export function OnboardingCaseDetailPanel({ item, actionStatus, onAction }: OnboardingCaseDetailPanelProps) {
  if (!item) {
    return (
      <EmptyState
        title="No case selected"
        description="Pick a case from the onboarding queue to review details and take actions."
      />
    );
  }

  const applyAction = async (action: OnboardingCaseAction) => {
    if ((action === 'REJECT' || action === 'HOLD') && !window.confirm(`Confirm ${action.toLowerCase()} for case ${item.caseId}?`)) {
      return;
    }

    await onAction(action);
  };

  return (
    <section className="onboarding-detail-panel" aria-label="case detail">
      <div className="onboarding-detail-header">
        <div>
          <h3>{item.caseId}</h3>
          <p>{item.entityId}</p>
        </div>
        <StatusBadge label={item.status} tone={toStatusTone(item.status)} />
      </div>

      <dl className="onboarding-detail-grid">
        <div>
          <dt>Entity Type</dt>
          <dd>{item.entityType ?? 'EKYC_SESSION'}</dd>
        </div>
        <div>
          <dt>Created At</dt>
          <dd>{new Date(item.createdAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Updated At</dt>
          <dd>{new Date(item.updatedAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Correlation</dt>
          <dd>{item.correlationId ?? 'N/A'}</dd>
        </div>
      </dl>

      <div className="onboarding-actions">
        <button type="button" onClick={() => void applyAction('APPROVE')} disabled={actionStatus.status === 'submitting'}>
          Approve
        </button>
        <button type="button" onClick={() => void applyAction('REJECT')} disabled={actionStatus.status === 'submitting'}>
          Reject
        </button>
        <button type="button" onClick={() => void applyAction('HOLD')} disabled={actionStatus.status === 'submitting'}>
          Hold
        </button>
        <button
          type="button"
          onClick={() => void applyAction('REQUEST_REVIEW')}
          disabled={actionStatus.status === 'submitting'}
        >
          Request Review
        </button>
      </div>

      {actionStatus.status === 'success' && <p className="action-success">{actionStatus.message}</p>}
      {actionStatus.status === 'error' && <p className="action-error">{actionStatus.error}</p>}

      <section className="onboarding-history" aria-label="case actions history">
        <h4>Action History</h4>
        {item.actions.length === 0 ? (
          <p className="panel-placeholder">No recorded actions yet.</p>
        ) : (
          <ul>
            {item.actions.map((action) => (
              <li key={action.actionId}>
                <span>{action.actionType}</span>
                <small>{new Date(action.createdAt).toLocaleString()}</small>
                <small>{action.oldStatus ? `${action.oldStatus} → ` : ''}{action.newStatus}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function toStatusTone(status: OnboardingCaseDetail['status']): StatusTone {
  switch (status) {
    case 'APPROVED':
      return 'success';
    case 'REJECTED':
      return 'danger';
    case 'ON_HOLD':
      return 'warning';
    default:
      return 'neutral';
  }
}
