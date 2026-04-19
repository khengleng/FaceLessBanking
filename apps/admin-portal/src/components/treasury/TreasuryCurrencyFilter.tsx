import { FilterBar } from '@/components/ui/FilterBar';

export type TreasuryCurrencyFilterProps = {
  currency: string;
  currencies: string[];
  onChange: (next: string) => void;
  onApply: () => void;
};

export function TreasuryCurrencyFilter({ currency, currencies, onChange, onApply }: TreasuryCurrencyFilterProps) {
  return (
    <FilterBar>
      <div className="treasury-filter-row">
        <label>
          Currency
          <select value={currency} onChange={(event) => onChange(event.target.value)}>
            <option value="ALL">All</option>
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="refresh-button" onClick={onApply}>
          Apply Filter
        </button>
      </div>
    </FilterBar>
  );
}
