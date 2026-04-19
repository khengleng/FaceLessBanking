import { FilterBar } from '@/components/ui/FilterBar';
import type { ReconciliationJobType } from '@/lib/api/reconciliation.client';

export type ReconciliationCreateFormProps = {
  selectedType: ReconciliationJobType;
  onTypeChange: (next: ReconciliationJobType) => void;
  onCreate: () => void;
  createState: {
    status: 'idle' | 'submitting' | 'success' | 'error';
    message: string | null;
    error: string | null;
  };
};

export function ReconciliationCreateForm({
  selectedType,
  onTypeChange,
  onCreate,
  createState
}: ReconciliationCreateFormProps) {
  return (
    <FilterBar>
      <div className="reconciliation-form-row">
        <label>
          Job Type
          <select
            value={selectedType}
            onChange={(event) => onTypeChange(event.target.value as ReconciliationJobType)}
          >
            <option value="PAYMENT_STATUS_RECON">PAYMENT_STATUS_RECON</option>
            <option value="BALANCE_SNAPSHOT_RECON">BALANCE_SNAPSHOT_RECON</option>
            <option value="LOAN_STATUS_RECON">LOAN_STATUS_RECON</option>
          </select>
        </label>

        <button
          type="button"
          className="refresh-button"
          onClick={onCreate}
          disabled={createState.status === 'submitting'}
        >
          Create Job
        </button>
      </div>

      {createState.status === 'success' ? <p className="action-success">{createState.message}</p> : null}
      {createState.status === 'error' ? <p className="action-error">{createState.error}</p> : null}
    </FilterBar>
  );
}
