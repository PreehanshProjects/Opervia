import InvoiceTable from "../components/InvoiceTable";
import FilterBar from "../components/FilterBar";
import Pager from "../components/Pager";
import type { Customer, InvoiceRow, Page } from "../domain";

const STATUSES = ["All", "Unpaid", "Partial", "Paid", "Overdue", "Void"];

export default function Invoices({
  page,
  loading,
  customers,
  filter,
  setFilter,
  customerId,
  setCustomerId,
  search,
  setSearch,
  from,
  to,
  setRange,
  onClearFilters,
  limit,
  offset,
  setOffset,
  onOpen,
  onNew,
}: {
  /** One page of results plus the true total of the filtered set. */
  page: Page<InvoiceRow> | null;
  loading: boolean;
  customers: Customer[];
  filter: string;
  setFilter: (f: string) => void;
  customerId: string;
  setCustomerId: (id: string) => void;
  search: string;
  setSearch: (s: string) => void;
  from: string;
  to: string;
  setRange: (from: string, to: string) => void;
  onClearFilters: () => void;
  limit: number;
  offset: number;
  setOffset: (n: number) => void;
  onOpen: (i: InvoiceRow) => void;
  onNew: () => void;
}) {
  const active =
    (filter !== "All" ? 1 : 0) +
    (customerId ? 1 : 0) +
    (search ? 1 : 0) +
    (from ? 1 : 0) +
    (to ? 1 : 0);
  return (
    <section className="panel">
      <div className="list-toolbar">
        <div
          className="tabs"
          role="group"
          aria-label="Filter invoices by status"
        >
          {STATUSES.map((f) => (
            <button
              type="button"
              className={filter === f ? "active" : ""}
              aria-pressed={filter === f}
              key={f}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <FilterBar
        search={search}
        setSearch={setSearch}
        searchLabel="Search invoices"
        from={from}
        to={to}
        setRange={setRange}
        active={active}
        onClear={onClearFilters}
      >
        <div className="filter-select">
          <label htmlFor="filter-customer">Customer</label>
          <select
            id="filter-customer"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">All customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>
      <div className={loading ? "list-loading" : ""}>
        <InvoiceTable
          invoices={page?.rows ?? []}
          onOpen={onOpen}
          onNew={onNew}
          filtered={active > 0}
        />
      </div>
      <Pager
        total={page?.total ?? 0}
        limit={limit}
        offset={offset}
        onOffset={setOffset}
        noun="invoices"
      />
    </section>
  );
}
