import { Link } from 'react-router-dom';

import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import type { PaymentItem } from '@/lib/api/payments.client';

export type PaymentsTableProps = {
  items: PaymentItem[];
};

export function PaymentsTable({ items }: PaymentsTableProps) {
  return (
    <div className="payments-table-wrap" role="region" aria-label="payments list table">
      <table className="payments-table">
        <thead>
          <tr>
            <th scope="col">Payment ID</th>
            <th scope="col">Source</th>
            <th scope="col">Destination</th>
            <th scope="col">Amount</th>
            <th scope="col">Status</th>
            <th scope="col">Correlation</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.paymentId}>
              <td>{item.paymentId}</td>
              <td>{item.sourceAccountId}</td>
              <td>{item.destinationAccountId}</td>
              <td>{item.amount.toLocaleString()} {item.currency}</td>
              <td>
                <StatusBadge label={item.status} tone={toStatusTone(item.status)} />
              </td>
              <td>{item.correlationId}</td>
              <td>
                <Link to={`/payments/${item.paymentId}`} className="link-button">Investigate</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function toStatusTone(status: string): StatusTone {
  if (status === 'COMPLETED') {
    return 'success';
  }

  if (status === 'FAILED' || status === 'REJECTED') {
    return 'danger';
  }

  if (status === 'PENDING' || status === 'PROCESSING' || status === 'ACCEPTED') {
    return 'warning';
  }

  return 'neutral';
}
