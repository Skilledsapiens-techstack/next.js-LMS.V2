import { Search } from 'lucide-react';
import { ReactNode } from 'react';

type FilterBarProps = {
  children?: ReactNode;
  searchPlaceholder?: string;
};

export function FilterBar({ children, searchPlaceholder = 'Search' }: FilterBarProps) {
  return (
    <section className="filter-bar" aria-label="Screen filters">
      <label className="filter-search">
        <Search size={16} />
        <span className="sr-only">Search</span>
        <input disabled placeholder={searchPlaceholder} type="search" />
      </label>
      <div className="filter-bar__controls">{children}</div>
    </section>
  );
}
