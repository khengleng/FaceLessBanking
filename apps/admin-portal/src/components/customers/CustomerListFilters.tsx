import { FilterBar } from '@/components/ui/FilterBar';
import type { CustomerListFilters as FiltersState } from '@/features/customers/use-customer-list';

export type CustomerListFiltersProps = {
  filters: FiltersState;
  onChange: (next: FiltersState) => void;
  onApply: () => void;
};

export function CustomerListFilters({ filters, onChange, onApply }: CustomerListFiltersProps) {
  return (
    <FilterBar>
      <div className="customer-filters">
        <label>
          Customer ID
          <input
            placeholder="cust-123"
            value={filters.customerId}
            onChange={(event) => onChange({ ...filters, customerId: event.target.value })}
          />
        </label>

        <label>
          Onboarding Reference
          <input
            placeholder="onboarding-ref-001"
            value={filters.onboardingReference}
            onChange={(event) => onChange({ ...filters, onboardingReference: event.target.value })}
          />
        </label>

        <button type="button" className="refresh-button" onClick={onApply}>
          Search
        </button>
      </div>
    </FilterBar>
  );
}
