import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { LoanReviewControls } from '@/components/loans/LoanReviewControls';
import type { LoanDetailBundle, LoanReviewAction } from '@/lib/api/loans.client';

export type LoanDetailPanelProps = {
  bundle: LoanDetailBundle;
  reviewEnabled: boolean;
  actionState: {
    status: 'idle' | 'submitting' | 'success' | 'error';
    message: string | null;
    error: string | null;
  };
  onReviewAction: (action: LoanReviewAction) => Promise<void>;
};

export function LoanDetailPanel({ bundle, reviewEnabled, actionState, onReviewAction }: LoanDetailPanelProps) {
  return (
    <section className="loan-detail-layout" aria-label="loan detail">
      <div className="loan-detail-grid">
        <article className="summary-card">
          <h3>Loan ID</h3>
          <p className="summary-card-value">{bundle.loan.loanId}</p>
        </article>
        <article className="summary-card">
          <h3>Application Status</h3>
          <p className="summary-card-value">
            <StatusBadge label={bundle.loan.status} tone={statusTone(bundle.loan.status)} />
          </p>
        </article>
        <article className="summary-card">
          <h3>Eligibility Result</h3>
          <p className="summary-card-value">{bundle.loan.eligibilityResult}</p>
        </article>
        <article className="summary-card">
          <h3>Approval Workflow State</h3>
          <p className="summary-card-value">
            <StatusBadge label={bundle.loan.approvalWorkflowState} tone={workflowTone(bundle.loan.approvalWorkflowState)} />
          </p>
        </article>
        <article className="summary-card">
          <h3>Loan Account State</h3>
          <p className="summary-card-value">
            <StatusBadge label={bundle.loan.loanAccountState} tone={statusTone(bundle.loan.loanAccountState)} />
          </p>
        </article>
        <article className="summary-card">
          <h3>Delinquency Status</h3>
          <p className="summary-card-value">
            <StatusBadge label={bundle.delinquency.status} tone={bundle.delinquency.status === 'DELINQUENT' ? 'danger' : 'success'} />
          </p>
        </article>
      </div>

      <section className="loan-detail-panels">
        <article className="timeline-panel">
          <h3>Loan Profile</h3>
          <dl className="onboarding-detail-grid">
            <div>
              <dt>Customer ID</dt>
              <dd>{bundle.loan.customerId}</dd>
            </div>
            <div>
              <dt>Loan Account ID</dt>
              <dd>{bundle.loan.loanAccountId}</dd>
            </div>
            <div>
              <dt>Principal</dt>
              <dd>{(bundle.loan.principalCents / 100).toLocaleString()} {bundle.loan.currency}</dd>
            </div>
            <div>
              <dt>Term</dt>
              <dd>{bundle.loan.termMonths} months</dd>
            </div>
            <div>
              <dt>Workflow Case</dt>
              <dd>{bundle.workflowCase?.caseId ?? 'Not linked'}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{new Date(bundle.loan.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
        </article>

        <article className="timeline-panel">
          <h3>Repayment Schedule</h3>
          <p className="panel-placeholder">{bundle.repaymentSchedule.message}</p>
        </article>

        <LoanReviewControls
          enabled={Boolean(bundle.workflowCase?.caseId) && reviewEnabled}
          actionState={actionState}
          onAction={onReviewAction}
        />
      </section>
    </section>
  );
}

function statusTone(status: string): StatusTone {
  if (status === 'ACTIVE' || status === 'DISBURSED') {
    return 'success';
  }

  if (status === 'DELINQUENT') {
    return 'danger';
  }

  if (status === 'CREATED' || status === 'DISBURSEMENT_PENDING') {
    return 'warning';
  }

  return 'neutral';
}

function workflowTone(status: string): StatusTone {
  if (status === 'APPROVED') {
    return 'success';
  }

  if (status === 'REJECTED') {
    return 'danger';
  }

  if (status === 'ON_HOLD' || status === 'IN_REVIEW' || status === 'NEW') {
    return 'warning';
  }

  return 'neutral';
}
