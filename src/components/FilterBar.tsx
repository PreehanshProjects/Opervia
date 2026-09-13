import { Search, X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The filter row above a list. Every control writes to the query that the
 * server runs, so what you filter is what gets counted — the total under the
 * table is the size of the filtered set, not of the page.
 */
export default function FilterBar({
  search,
  setSearch,
  searchLabel,
  from,
  to,
  setRange,
  active,
  onClear,
  children,
}: {
  search: string;
  setSearch: (s: string) => void;
  searchLabel: string;
  from: string;
  to: string;
  setRange: (from: string, to: string) => void;
  /** How many filters are currently narrowing the list. */
  active: number;
  onClear: () => void;
  /** Selects specific to the view: status, customer, category. */
  children?: ReactNode;
}) {
  return (
    <div className="filter-bar">
      <div className="search-box">
        <Search size={17} />
        <input
          aria-label={searchLabel}
          placeholder={searchLabel}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {!!search && (
          <button
            type="button"
            className="icon-button search-clear"
            aria-label="Clear search"
            onClick={() => setSearch("")}
          >
            <X size={16} />
          </button>
        )}
      </div>
      {children}
      <div className="filter-date">
        <label htmlFor="filter-from">From</label>
        <input
          id="filter-from"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => setRange(e.target.value, to)}
        />
      </div>
      <div className="filter-date">
        <label htmlFor="filter-to">To</label>
        <input
          id="filter-to"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => setRange(from, e.target.value)}
        />
      </div>
      {active > 0 && (
        <button type="button" className="text-button" onClick={onClear}>
          <X size={15} />
          Clear {active === 1 ? "filter" : `${active} filters`}
        </button>
      )}
    </div>
  );
}
