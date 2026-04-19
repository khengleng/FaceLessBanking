import { EmptyState } from '@/components/ui/EmptyState';
import { FilterBar } from '@/components/ui/FilterBar';
import { PageContainer } from '@/components/ui/PageContainer';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { useDashboardSnapshot } from '@/features/dashboard/use-dashboard-snapshot';
import type { OpsDashboardClient } from '@/lib/api/ops-dashboard.client';

export type DashboardHomePageProps = {
  client?: OpsDashboardClient;
};

export function DashboardHomePage({ client }: DashboardHomePageProps) {
  const { state, snapshot, reload } = useDashboardSnapshot(client);

  if (state.status === 'loading') {
    return (
      <PageContainer>
        <DashboardSkeleton />
      </PageContainer>
    );
  }

  if (state.status === 'error') {
    return (
      <PageContainer>
        <EmptyState
          title="Dashboard data unavailable"
          description={`Unable to load dashboard snapshot: ${state.error}`}
        />
      </PageContainer>
    );
  }

  if (state.status === 'empty') {
    return (
      <PageContainer>
        <div className="page-header">
          <div>
            <h2>Dashboard</h2>
            <p>Operational snapshot and queue monitoring.</p>
          </div>
        </div>
        <EmptyState
          title="No dashboard data yet"
          description="Metrics and activity will appear once connected services return data."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Operational snapshot and queue monitoring.</p>
        </div>
        <button type="button" className="refresh-button" onClick={() => void reload()}>
          Refresh
        </button>
      </div>

      <FilterBar>
        <span>Dashboard filters placeholder (region, severity, business date)</span>
      </FilterBar>

      <section className="summary-grid" aria-label="summary widgets">
        <SummaryCard label="Onboarding Pending" value={snapshot.onboardingPending} tone="warning" />
        <SummaryCard label="Payments Failed" value={snapshot.paymentsFailed} tone="danger" />
        <SummaryCard label="Loans In Review" value={snapshot.loansInReview} tone="warning" />
        <SummaryCard label="Open Disputes" value={snapshot.openDisputes} tone="warning" />
        <SummaryCard label="Reconciliation Mismatches" value={snapshot.reconciliationMismatches} tone="danger" />
        <SummaryCard
          label="Liquidity Summary"
          value={`${snapshot.liquiditySummary.availableLiquidity.toLocaleString()} ${snapshot.liquiditySummary.currency}`}
          tone="neutral"
        />
      </section>

      <section className="dashboard-two-column">
        <RecentActivity items={snapshot.recentActivity} />
        <AlertsPanel alerts={snapshot.alerts} />
      </section>
    </PageContainer>
  );
}
