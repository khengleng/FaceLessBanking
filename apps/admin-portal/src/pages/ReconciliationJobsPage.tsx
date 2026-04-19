import { useState } from 'react';

import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageContainer } from '@/components/ui/PageContainer';
import { ReconciliationCreateForm } from '@/components/reconciliation/ReconciliationCreateForm';
import { ReconciliationJobsTable } from '@/components/reconciliation/ReconciliationJobsTable';
import { useReconciliationJobs } from '@/features/reconciliation/use-reconciliation-jobs';
import type { ReconciliationClient, ReconciliationJobType } from '@/lib/api/reconciliation.client';

export type ReconciliationJobsPageProps = {
  client?: ReconciliationClient;
};

export function ReconciliationJobsPage({ client }: ReconciliationJobsPageProps) {
  const [jobType, setJobType] = useState<ReconciliationJobType>('PAYMENT_STATUS_RECON');
  const { items, warnings, state, createState, createJob, reload } = useReconciliationJobs(client);

  if (state.status === 'loading') {
    return (
      <PageContainer>
        <LoadingState message="Loading reconciliation jobs..." />
      </PageContainer>
    );
  }

  if (state.status === 'error') {
    return (
      <PageContainer>
        <ErrorState title="Reconciliation unavailable" description={`Unable to load jobs: ${state.error}`} onRetry={() => void reload()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>Reconciliation Jobs</h2>
          <p>Create, run, and inspect reconciliation executions and mismatch outcomes.</p>
        </div>
        <button type="button" className="refresh-button" onClick={() => void reload()}>
          Refresh
        </button>
      </div>

      <ReconciliationCreateForm
        selectedType={jobType}
        onTypeChange={setJobType}
        onCreate={() => void createJob(jobType)}
        createState={createState}
      />

      {warnings.length > 0 ? (
        <div className="warning-banner" role="status">
          Some reconciliation sources are partial: {warnings.join(', ')}
        </div>
      ) : null}

      {state.status === 'empty' ? (
        <EmptyState
          title="No reconciliation jobs found"
          description="Create a reconciliation job to start validation and mismatch tracking."
        />
      ) : (
        <ReconciliationJobsTable items={items} />
      )}
    </PageContainer>
  );
}
