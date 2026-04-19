import { Link } from 'react-router-dom';

import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import type { CustomerListItem } from '@/lib/api/customers.client';

export type CustomerListTableProps = {
  items: CustomerListItem[];
};

export function CustomerListTable({ items }: CustomerListTableProps) {
  return (
    <div className="customer-table-wrap" role="region" aria-label="customer list table">
      <table className="customer-table">
        <thead>
          <tr>
            <th scope="col">Customer</th>
            <th scope="col">Email</th>
            <th scope="col">Status</th>
            <th scope="col">Created At</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.customerId}>
              <td>
                <strong>{item.firstName} {item.lastName}</strong>
                <div className="subtle">{item.customerId}</div>
              </td>
              <td>{item.email}</td>
              <td>
                <StatusBadge label={item.status} tone={statusTone(item.status)} />
              </td>
              <td>{new Date(item.createdAt).toLocaleString()}</td>
              <td>
                <Link to={`/customers/${item.customerId}`} className="link-button">
                  Open 360
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
  const normalized = status.toUpperCase();

  if (normalized === 'ACTIVE' || normalized === 'VERIFIED') {
    return 'success';
  }

  if (normalized === 'REJECTED' || normalized === 'SUSPENDED') {
    return 'danger';
  }

  if (normalized.includes('REVIEW') || normalized.includes('PENDING')) {
    return 'warning';
  }

  return 'neutral';
}
