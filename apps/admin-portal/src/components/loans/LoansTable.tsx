import { Link } from 'react-router-dom';

import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import type { LoanItem } from '@/lib/api/loans.client';

export type LoansTableProps = {
  items: LoanItem[];
};

export function LoansTable({ items }: LoansTableProps) {
  return (
    <div className="loans-table-wrap" role="region" aria-label="loans list table">
      <table className="loans-table">
        <thead>
          <tr>
            <th scope="col">Loan ID</th>
            <th scope="col">Customer</th>
            <th scope="col">Application Status</th>
            <th scope="col">Eligibility</th>
            <th scope="col">Workflow State</th>
            <th scope="col">Loan Account State</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.loanId}>
              <td>{item.loanId}</td>
              <td>{item.customerId}</td>
              <td>
                <StatusBadge label={item.status} tone={toStatusTone(item.status)} />
              </td>
              <td>{item.eligibilityResult}</td>
              <td>
                <StatusBadge label={item.approvalWorkflowState} tone={toWorkflowTone(item.approvalWorkflowState)} />
              </td>
              <td>
                <StatusBadge label={item.loanAccountState} tone={toStatusTone(item.loanAccountState)} />
              </td>
              <td>
                <Link to={`/loans/${item.loanId}`} className="link-button">Investigate</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function toStatusTone(status: string): StatusTone {
  if (status === 'ACTIVE' || status === 'DISBURSED') {
    return 'success';
  }

  if (status === 'DELINQUENT') {
    return 'danger';
  }

  if (status === 'CREATED' || status === 'DISBURSEMENT_PENDING') {
    return 'warning';
  }

  return 'neutral';
}

function toWorkflowTone(status: string): StatusTone {
  if (status === 'APPROVED') {
    return 'success';
  }

  if (status === 'REJECTED') {
    return 'danger';
  }

  if (status === 'ON_HOLD' || status === 'IN_REVIEW' || status === 'NEW') {
    return 'warning';
  }

  return 'neutral';
}
