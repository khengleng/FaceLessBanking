import type { LiquidityPosition } from '@/lib/api/treasury.client';

export type LiquidityPositionsTableProps = {
  items: LiquidityPosition[];
};

export function LiquidityPositionsTable({ items }: LiquidityPositionsTableProps) {
  return (
    <div className="treasury-table-wrap" role="region" aria-label="liquidity positions table">
      <table className="treasury-table">
        <thead>
          <tr>
            <th scope="col">Currency</th>
            <th scope="col">Available</th>
            <th scope="col">Reserved</th>
            <th scope="col">Outgoing Pending</th>
            <th scope="col">Incoming Pending</th>
            <th scope="col">Updated At</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.currency}>
              <td>{item.currency}</td>
              <td>{formatCents(item.availableCashCents, item.currency)}</td>
              <td>{formatCents(item.reservedCashCents, item.currency)}</td>
              <td>{formatCents(item.outgoingPendingCents, item.currency)}</td>
              <td>{formatCents(item.incomingPendingCents, item.currency)}</td>
              <td>{new Date(item.updatedAt).toLocaleString()}</td>
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
