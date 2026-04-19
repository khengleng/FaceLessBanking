import { Link } from 'react-router-dom';

import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import type { ReconciliationJob } from '@/lib/api/reconciliation.client';

export type ReconciliationJobsTableProps = {
  items: ReconciliationJob[];
};

export function ReconciliationJobsTable({ items }: ReconciliationJobsTableProps) {
  return (
    <div className="reconciliation-table-wrap" role="region" aria-label="reconciliation jobs table">
      <table className="reconciliation-table">
        <thead>
          <tr>
            <th scope="col">Job ID</th>
            <th scope="col">Job Type</th>
            <th scope="col">Status</th>
            <th scope="col">Created</th>
            <th scope="col">Mismatches</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.jobId}>
              <td>{item.jobId}</td>
              <td>{item.jobType}</td>
              <td>
                <StatusBadge label={item.status} tone={toStatusTone(item.status)} />
              </td>
              <td>{new Date(item.createdAt).toLocaleString()}</td>
              <td>{typeof item.mismatchCount === 'number' ? item.mismatchCount : '-'}</td>
              <td>
                <Link to={`/reconciliation/${item.jobId}`} className="link-button">View</Link>
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

  if (status === 'FAILED') {
    return 'danger';
  }

  if (status === 'RUNNING' || status === 'PENDING') {
    return 'warning';
  }

  return 'neutral';
}
