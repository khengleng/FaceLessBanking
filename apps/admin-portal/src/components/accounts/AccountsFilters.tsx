import { FilterBar } from '@/components/ui/FilterBar';
import type { AccountsFiltersState } from '@/features/accounts/use-accounts-list';

export type AccountsFiltersProps = {
  filters: AccountsFiltersState;
  onChange: (next: AccountsFiltersState) => void;
  onApply: () => void;
};

export function AccountsFilters({ filters, onChange, onApply }: AccountsFiltersProps) {
  return (
    <FilterBar>
      <div className="accounts-filters">
        <label>
          Status
          <select value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value })}>
            <option value="ALL">All</option>
            <option value="PENDING_ACTIVATION">PENDING_ACTIVATION</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </label>

        <label>
          Account Type
          <select
            value={filters.accountType}
            onChange={(event) => onChange({ ...filters, accountType: event.target.value })}
          >
            <option value="ALL">All</option>
            <option value="SAVINGS">SAVINGS</option>
            <option value="CURRENT">CURRENT</option>
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

        <button type="button" className="refresh-button" onClick={onApply}>
          Apply Filters
        </button>
      </div>
    </FilterBar>
  );
}
