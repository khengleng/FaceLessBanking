import { Link } from 'react-router-dom';

import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { toAccountType, type AccountListItem } from '@/lib/api/accounts.client';

export type AccountsTableProps = {
  items: AccountListItem[];
};

export function AccountsTable({ items }: AccountsTableProps) {
  return (
    <div className="accounts-table-wrap" role="region" aria-label="accounts list table">
      <table className="accounts-table">
        <thead>
          <tr>
            <th scope="col">Account ID</th>
            <th scope="col">Customer</th>
            <th scope="col">Type</th>
            <th scope="col">Status</th>
            <th scope="col">Created At</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.accountId}>
              <td>{item.accountId}</td>
              <td>{item.customerId}</td>
              <td>{toAccountType(item.productCode)}</td>
              <td>
                <StatusBadge label={item.status} tone={statusTone(item.status)} />
              </td>
              <td>{new Date(item.createdAt).toLocaleString()}</td>
              <td>
                <Link to={`/accounts/${item.accountId}`} className="link-button">
                  Investigate
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function statusTone(status: string): StatusTone {
  if (status === 'ACTIVE') {
    return 'success';
  }

  if (status === 'PENDING_ACTIVATION') {
    return 'warning';
  }

  if (status === 'SUSPENDED' || status === 'CLOSED') {
    return 'danger';
  }

  return 'neutral';
}
