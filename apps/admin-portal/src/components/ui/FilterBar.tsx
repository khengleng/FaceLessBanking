import type { PropsWithChildren } from 'react';

export function FilterBar({ children }: PropsWithChildren) {
  return (
    <div className="filter-bar" role="region" aria-label="filters">
      {children ?? <span>Filter controls placeholder</span>}
    </div>
  );
}
