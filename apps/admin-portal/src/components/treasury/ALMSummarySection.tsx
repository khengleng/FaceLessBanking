import { EmptyState } from '@/components/ui/EmptyState';
import type { ALMSummary } from '@/lib/api/treasury.client';

export type ALMSummarySectionProps = {
  summary: ALMSummary | null;
};

export function ALMSummarySection({ summary }: ALMSummarySectionProps) {
  if (!summary) {
    return (
      <EmptyState
        title="ALM summary unavailable"
        description="ALM totals will appear once summary data is available from the ALM service."
      />
    );
  }

  const assets = Number(summary.totalAssetsCents);
  const liabilities = Number(summary.totalLiabilitiesCents);
  const denominator = Math.max(assets, liabilities, 1);
  const assetsWidth = Math.max(4, Math.min(100, (assets / denominator) * 100));
  const liabilitiesWidth = Math.max(4, Math.min(100, (liabilities / denominator) * 100));

  return (
    <section className="treasury-panel" aria-label="alm summary">
      <h3>ALM Summary</h3>
      <div className="treasury-metric-grid">
        <article className="summary-card">
          <h3>Total Assets</h3>
          <p className="summary-card-value">{formatCents(summary.totalAssetsCents)}</p>
        </article>
        <article className="summary-card">
          <h3>Total Liabilities</h3>
          <p className="summary-card-value">{formatCents(summary.totalLiabilitiesCents)}</p>
        </article>
        <article className="summary-card">
          <h3>Net Position</h3>
          <p className="summary-card-value">{formatCents(summary.netPositionCents)}</p>
        </article>
      </div>

      <div className="treasury-chart-block" aria-label="assets vs liabilities chart">
        <div>
          <strong>Assets</strong>
          <div className="treasury-bar-track"><span className="treasury-bar assets" style={{ width: `${assetsWidth}%` }} /></div>
        </div>
        <div>
          <strong>Liabilities</strong>
          <div className="treasury-bar-track"><span className="treasury-bar liabilities" style={{ width: `${liabilitiesWidth}%` }} /></div>
        </div>
      </div>

      <p className="subtle">Currencies tracked: {summary.currenciesCount}</p>
    </section>
  );
}

function formatCents(value: bigint): string {
  const absolute = value < 0n ? -value : value;
  const whole = absolute / 100n;
  const cents = absolute % 100n;
  const signed = value < 0n ? '-' : '';
  return `${signed}${whole.toLocaleString()}.${cents.toString().padStart(2, '0')}`;
}
