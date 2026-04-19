import { FilterBar } from '@/components/ui/FilterBar';
import {
  ONBOARDING_CASE_STATUSES,
  type OnboardingCaseStatus
} from '@/lib/api/workflow-cases.client';
import type { OnboardingFiltersState } from '@/features/onboarding/use-onboarding-review-queue';

export type OnboardingReviewFiltersProps = {
  filters: OnboardingFiltersState;
  onChange: (next: OnboardingFiltersState) => void;
  onApply: () => void;
};

export function OnboardingReviewFilters({ filters, onChange, onApply }: OnboardingReviewFiltersProps) {
  return (
    <FilterBar>
      <div className="onboarding-filters">
        <label>
          Status
          <select
            value={filters.status}
            onChange={(event) =>
              onChange({
                ...filters,
                status: event.target.value as OnboardingCaseStatus | 'ALL'
              })
            }
          >
            <option value="ALL">All</option>
            {ONBOARDING_CASE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label>
          Entity / Onboarding Ref
          <input
            value={filters.entityId}
            onChange={(event) =>
              onChange({
                ...filters,
                entityId: event.target.value
              })
            }
            placeholder="e.g. ekyc-session-123"
          />
        </label>

        <label>
          Date From
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) =>
              onChange({
                ...filters,
                dateFrom: event.target.value
              })
            }
          />
        </label>

        <label>
          Date To
          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) =>
              onChange({
                ...filters,
                dateTo: event.target.value
              })
            }
          />
        </label>

        <button type="button" className="refresh-button" onClick={onApply}>
          Apply Filters
        </button>
      </div>
    </FilterBar>
  );
}
