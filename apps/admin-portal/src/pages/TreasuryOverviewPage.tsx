import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageContainer } from '@/components/ui/PageContainer';
import { ALMSummarySection } from '@/components/treasury/ALMSummarySection';
import { LiquidityPositionsTable } from '@/components/treasury/LiquidityPositionsTable';
import { MaturityBucketsTable } from '@/components/treasury/MaturityBucketsTable';
import { RepricingGapsPanel } from '@/components/treasury/RepricingGapsPanel';
import { TreasuryCurrencyFilter } from '@/components/treasury/TreasuryCurrencyFilter';
import { TreasuryTransfersPlaceholder } from '@/components/treasury/TreasuryTransfersPlaceholder';
import { useTreasuryOverview } from '@/features/treasury/use-treasury-overview';
import type { TreasuryClient } from '@/lib/api/treasury.client';

export type TreasuryOverviewPageProps = {
  client?: TreasuryClient;
};

export function TreasuryOverviewPage({ client }: TreasuryOverviewPageProps) {
  const { currency, setCurrency, overview, state, currencies, reload } = useTreasuryOverview(client);

  if (state.status === 'loading') {
    return (
      <PageContainer>
        <LoadingState message="Loading treasury overview..." />
      </PageContainer>
    );
  }

  if (state.status === 'error' || !overview) {
    return (
      <PageContainer>
        <ErrorState
          title="Treasury overview unavailable"
          description={`Unable to load treasury overview: ${state.error ?? 'treasury_overview_unavailable'}`}
          onRetry={() => void reload()}
        />
      </PageContainer>
    );
  }

  if (state.status === 'empty') {
    return (
      <PageContainer>
        <div className="page-header">
          <div>
            <h2>Treasury / Liquidity / ALM</h2>
            <p>Liquidity positions, ALM metrics, and maturity profile visibility.</p>
          </div>
          <button type="button" className="refresh-button" onClick={() => void reload()}>
            Refresh
          </button>
        </div>

        <TreasuryCurrencyFilter
          currency={currency}
          currencies={currencies}
          onChange={setCurrency}
          onApply={() => void reload()}
        />

        <EmptyState
          title="No treasury data found"
          description="No liquidity or ALM records are available for the selected filter."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h2>Treasury / Liquidity / ALM</h2>
          <p>Liquidity positions, ALM summary, maturity buckets, and repricing gap placeholders.</p>
        </div>
        <button type="button" className="refresh-button" onClick={() => void reload()}>
          Refresh
        </button>
      </div>

      <TreasuryCurrencyFilter
        currency={currency}
        currencies={currencies}
        onChange={setCurrency}
        onApply={() => void reload()}
      />

      {overview.warnings.length > 0 ? (
        <div className="warning-banner" role="status">
          Some treasury sources are partial: {overview.warnings.join(', ')}
        </div>
      ) : null}

      <section className="treasury-panel" aria-label="liquidity positions section">
        <h3>Liquidity Positions</h3>
        {overview.liquidityPositions.length === 0 ? (
          <p className="panel-placeholder">No liquidity positions found for the selected view.</p>
        ) : (
          <LiquidityPositionsTable items={overview.liquidityPositions} />
        )}
      </section>

      <TreasuryTransfersPlaceholder />

      <ALMSummarySection summary={overview.almSummary} />

      <section className="treasury-panel" aria-label="maturity buckets section">
        <h3>Maturity Buckets</h3>
        {overview.maturityBuckets.length === 0 ? (
          <p className="panel-placeholder">No maturity bucket rows found for the selected currency.</p>
        ) : (
          <MaturityBucketsTable items={overview.maturityBuckets} />
        )}
      </section>

      <RepricingGapsPanel items={overview.repricingGaps} />
    </PageContainer>
  );
}
