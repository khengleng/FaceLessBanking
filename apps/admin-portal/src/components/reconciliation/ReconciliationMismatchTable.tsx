import type { ReconciliationMismatch } from '@/lib/api/reconciliation.client';

export type ReconciliationMismatchTableProps = {
  items: ReconciliationMismatch[];
};

export function ReconciliationMismatchTable({ items }: ReconciliationMismatchTableProps) {
  return (
    <div className="reconciliation-table-wrap" role="region" aria-label="reconciliation mismatch table">
      <table className="reconciliation-table">
        <thead>
          <tr>
            <th scope="col">Mismatch ID</th>
            <th scope="col">Entity Type</th>
            <th scope="col">Entity ID</th>
            <th scope="col">Mismatch Type</th>
            <th scope="col">Expected</th>
            <th scope="col">Actual</th>
            <th scope="col">Created</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.mismatchId}>
              <td>{item.mismatchId}</td>
              <td>{item.entityType}</td>
              <td>{item.entityId}</td>
              <td>{item.mismatchType}</td>
              <td>{item.expectedValue}</td>
              <td>{item.actualValue}</td>
              <td>{new Date(item.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
