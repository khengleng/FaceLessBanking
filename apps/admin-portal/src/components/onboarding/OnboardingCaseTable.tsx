import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import type { OnboardingCase } from '@/lib/api/workflow-cases.client';

export type OnboardingCaseTableProps = {
  rows: OnboardingCase[];
  selectedCaseId: string | null;
  onSelect: (caseId: string) => void;
};

export function OnboardingCaseTable({ rows, selectedCaseId, onSelect }: OnboardingCaseTableProps) {
  return (
    <div className="onboarding-table-wrap" role="region" aria-label="onboarding cases table">
      <table className="onboarding-table">
        <thead>
          <tr>
            <th scope="col">Case ID</th>
            <th scope="col">Entity</th>
            <th scope="col">Status</th>
            <th scope="col">Updated At</th>
            <th scope="col">Correlation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr
              key={item.caseId}
              className={selectedCaseId === item.caseId ? 'selected' : ''}
              onClick={() => onSelect(item.caseId)}
            >
              <td>{item.caseId}</td>
              <td>{item.entityId}</td>
              <td>
                <StatusBadge label={item.status} tone={toStatusTone(item.status)} />
              </td>
              <td>{new Date(item.updatedAt).toLocaleString()}</td>
              <td>{item.correlationId ?? 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function toStatusTone(status: OnboardingCase['status']): StatusTone {
  switch (status) {
    case 'APPROVED':
      return 'success';
    case 'REJECTED':
      return 'danger';
    case 'ON_HOLD':
      return 'warning';
    default:
      return 'neutral';
  }
}
