import type { MaturityBucket } from '@/lib/api/treasury.client';

export type MaturityBucketsTableProps = {
  items: MaturityBucket[];
};

export function MaturityBucketsTable({ items }: MaturityBucketsTableProps) {
  return (
    <div className="treasury-table-wrap" role="region" aria-label="maturity buckets table">
      <table className="treasury-table">
        <thead>
          <tr>
            <th scope="col">Bucket</th>
            <th scope="col">Currency</th>
            <th scope="col">Inflow</th>
            <th scope="col">Outflow</th>
            <th scope="col">Net Gap</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.bucketKey}-${item.currency}-${index}`}>
              <td>{item.bucketKey}</td>
              <td>{item.currency}</td>
              <td>{formatCents(item.inflowCents, item.currency)}</td>
              <td>{formatCents(item.outflowCents, item.currency)}</td>
              <td>{formatCents(item.netGapCents, item.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCents(value: bigint, currency: string): string {
  const absolute = value < 0n ? -value : value;
  const whole = absolute / 100n;
  const cents = absolute % 100n;
  const signed = value < 0n ? '-' : '';
  return `${signed}${whole.toLocaleString()}.${cents.toString().padStart(2, '0')} ${currency}`;
}
