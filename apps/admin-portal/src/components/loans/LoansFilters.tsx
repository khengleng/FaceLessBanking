import { FilterBar } from '@/components/ui/FilterBar';
import type { LoanFiltersState } from '@/features/loans/use-loans-list';

export type LoansFiltersProps = {
  filters: LoanFiltersState;
  onChange: (next: LoanFiltersState) => void;
  onApply: () => void;
};

export function LoansFilters({ filters, onChange, onApply }: LoansFiltersProps) {
  return (
    <FilterBar>
      <div className="loans-filters">
        <label>
          Status
          <select value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value })}>
            <option value="ALL">All</option>
            <option value="CREATED">CREATED</option>
            <option value="DISBURSEMENT_PENDING">DISBURSEMENT_PENDING</option>
            <option value="DISBURSED">DISBURSED</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="DELINQUENT">DELINQUENT</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </label>

        <label>
          Customer ID
          <input
            placeholder="cust-123"
            value={filters.customerId}
            onChange={(event) => onChange({ ...filters, customerId: event.target.value })}
          />
        </label>

        <label>
          Loan Account ID
          <input
            placeholder="loan-123"
            value={filters.loanAccountId}
            onChange={(event) => onChange({ ...filters, loanAccountId: event.target.value })}
          />
        </label>

        <button type="button" className="refresh-button" onClick={onApply}>
          Apply Filters
        </button>
      </div>
    </FilterBar>
  );
}
