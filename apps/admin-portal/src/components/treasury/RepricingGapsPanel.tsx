import { EmptyState } from '@/components/ui/EmptyState';
import type { RepricingGap } from '@/lib/api/treasury.client';

export type RepricingGapsPanelProps = {
  items: RepricingGap[];
};

export function RepricingGapsPanel({ items }: RepricingGapsPanelProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Repricing gaps placeholder"
        description="Repricing gap rows will appear when IRR repricing data is available for the selected currency."
      />
    );
  }

  return (
    <section className="treasury-panel" aria-label="repricing gaps panel">
      <h3>Repricing Gaps</h3>
      <div className="treasury-table-wrap" role="region" aria-label="repricing gaps table">
        <table className="treasury-table">
          <thead>
            <tr>
              <th scope="col">Bucket</th>
              <th scope="col">Repricing Assets</th>
              <th scope="col">Repricing Liabilities</th>
              <th scope="col">Gap</th>
              <th scope="col">Cumulative Gap</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.bucketCode}>
                <td>{item.bucketCode}</td>
                <td>{formatCents(item.repricingAssetsCents)}</td>
                <td>{formatCents(item.repricingLiabilitiesCents)}</td>
                <td>{formatCents(item.gapCents)}</td>
                <td>{formatCents(item.cumulativeGapCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
