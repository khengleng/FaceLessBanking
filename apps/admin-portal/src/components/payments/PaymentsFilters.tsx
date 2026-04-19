import { FilterBar } from '@/components/ui/FilterBar';
import type { PaymentsFiltersState } from '@/features/payments/use-payments-list';

export type PaymentsFiltersProps = {
  filters: PaymentsFiltersState;
  onChange: (next: PaymentsFiltersState) => void;
  onApply: () => void;
};

export function PaymentsFilters({ filters, onChange, onApply }: PaymentsFiltersProps) {
  return (
    <FilterBar>
      <div className="payments-filters">
        <label>
          Status
          <select value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value })}>
            <option value="ALL">All</option>
            <option value="ACCEPTED">ACCEPTED</option>
            <option value="PENDING">PENDING</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="FAILED">FAILED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </label>

        <label>
          Date From
          <input type="date" value={filters.dateFrom} onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })} />
        </label>

        <label>
          Date To
          <input type="date" value={filters.dateTo} onChange={(event) => onChange({ ...filters, dateTo: event.target.value })} />
        </label>

        <label>
          Account ID
          <input
            placeholder="acc-123"
            value={filters.accountId}
            onChange={(event) => onChange({ ...filters, accountId: event.target.value })}
          />
        </label>

        <label>
          Correlation ID
          <input
            placeholder="corr-..."
            value={filters.correlationId}
            onChange={(event) => onChange({ ...filters, correlationId: event.target.value })}
          />
        </label>

        <button type="button" className="refresh-button" onClick={onApply}>
          Apply Filters
        </button>
      </div>
    </FilterBar>
  );
}
