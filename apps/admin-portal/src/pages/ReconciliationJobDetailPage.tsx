import { Link, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageContainer } from '@/components/ui/PageContainer';
import { ReconciliationMismatchTable } from '@/components/reconciliation/ReconciliationMismatchTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useReconciliationJobDetail } from '@/features/reconciliation/use-reconciliation-job-detail';
import type { ReconciliationClient } from '@/lib/api/reconciliation.client';

export type ReconciliationJobDetailPageProps = {
  client?: ReconciliationClient;
};

export function ReconciliationJobDetailPage({ client }: ReconciliationJobDetailPageProps) {
  const { jobId } = useParams<{ jobId: string }>();
  const { detail, state, runState, run, reload } = useReconciliationJobDetail(jobId, client);

  if (state.status === 'loading') {
    return (
      <PageContainer>
        <LoadingState message="Loading reconciliation detail..." />
      </PageContainer>
    );
  }

  if (state.status === 'error' || !detail) {
    return (
      <PageContainer>
        <div className="page-header">
          <div>
            <h2>Reconciliation Job Detail</h2>
            <p>Inspect reconciliation status and mismatches.</p>
          </div>
          <Link to="/reconciliation" className="link-button">Back to Reconciliation</Link>
        </div>

        <ErrorState
          title="Job detail unavailable"
          description={`Unable to load job detail: ${state.error ?? 'reconciliation_detail_unavailable'}`}
          onRetry={() => void reload()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>{detail.job.jobId}</h2>
          <p>{detail.job.jobType}</p>
        </div>
        <div className="header-actions">
          <button type="button" className="refresh-button" onClick={() => void reload()}>
            Refresh
          </button>
          <button
            type="button"
            className="refresh-button"
            onClick={() => {
              if (!window.confirm(`Run reconciliation job ${detail.job.jobId}?`)) {
                return;
              }
              void run();
            }}
            disabled={runState.status === 'submitting'}
          >
            Run Job
          </button>
          <Link to="/reconciliation" className="link-button">Back</Link>
        </div>
      </div>

      {runState.status === 'success' ? <p className="action-success">{runState.message}</p> : null}
      {runState.status === 'error' ? <p className="action-error">{runState.error}</p> : null}

      <section className="loan-detail-grid" aria-label="reconciliation summary">
        <article className="summary-card">
          <h3>Status</h3>
          <p className="summary-card-value"><StatusBadge label={detail.job.status} tone={detail.job.status === 'COMPLETED' ? 'success' : detail.job.status === 'FAILED' ? 'danger' : 'warning'} /></p>
        </article>
        <article className="summary-card">
          <h3>Mismatch Count</h3>
          <p className="summary-card-value">{detail.mismatchCount}</p>
        </article>
        <article className="summary-card">
          <h3>Created At</h3>
          <p className="summary-card-value">{new Date(detail.job.createdAt).toLocaleString()}</p>
        </article>
      </section>

      {detail.mismatches.length === 0 ? (
        <EmptyState
          title="No mismatches detected"
          description="Mismatch details will appear here once reconciliation identifies discrepancies."
        />
      ) : (
        <ReconciliationMismatchTable items={detail.mismatches} />
      )}
    </PageContainer>
  );
}
