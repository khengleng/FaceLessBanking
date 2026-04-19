import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageContainer } from '@/components/ui/PageContainer';
import { OnboardingCaseDetailPanel } from '@/components/onboarding/OnboardingCaseDetailPanel';
import { OnboardingCaseTable } from '@/components/onboarding/OnboardingCaseTable';
import { OnboardingReviewFilters } from '@/components/onboarding/OnboardingReviewFilters';
import { useOnboardingReviewQueue } from '@/features/onboarding/use-onboarding-review-queue';
import type { WorkflowCasesClient } from '@/lib/api/workflow-cases.client';

export type OnboardingReviewPageProps = {
  client?: WorkflowCasesClient;
};

export function OnboardingReviewPage({ client }: OnboardingReviewPageProps) {
  const {
    filters,
    setFilters,
    cases,
    queueState,
    detailState,
    actionState,
    selection,
    reloadCases,
    applyAction
  } = useOnboardingReviewQueue(client);

  if (queueState.status === 'loading') {
    return (
      <PageContainer>
        <LoadingState message="Loading onboarding queue..." />
      </PageContainer>
    );
  }

  if (queueState.status === 'error') {
    return (
      <PageContainer>
        <ErrorState
          title="Onboarding queue unavailable"
          description={`Unable to load onboarding cases: ${queueState.error}`}
          onRetry={() => void reloadCases()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>Onboarding Review Queue</h2>
          <p>Review onboarding cases, inspect details, and apply manual workflow actions safely.</p>
        </div>
        <button type="button" className="refresh-button" onClick={() => void reloadCases()}>
          Refresh
        </button>
      </div>

      <OnboardingReviewFilters filters={filters} onChange={setFilters} onApply={() => void reloadCases()} />

      {queueState.status === 'empty' ? (
        <EmptyState
          title="No onboarding cases found"
          description="No onboarding review cases match the current filters."
        />
      ) : (
        <section className="onboarding-layout">
          <OnboardingCaseTable
            rows={cases}
            selectedCaseId={selection.selectedCaseId}
            onSelect={selection.setSelectedCaseId}
          />

          {detailState.status === 'loading' ? (
            <div className="onboarding-detail-panel">
              <LoadingState message="Loading case detail..." />
            </div>
          ) : detailState.status === 'error' ? (
            <ErrorState
              title="Case detail unavailable"
              description={`Unable to load case detail: ${detailState.error}`}
              onRetry={() => void reloadCases()}
            />
          ) : (
            <OnboardingCaseDetailPanel item={selection.selectedCase} actionStatus={actionState} onAction={applyAction} />
          )}
        </section>
      )}
    </PageContainer>
  );
}
