import { ChevronRight, Download } from "lucide-react";
import Empty from "../components/Empty";
import FilterBar from "../components/FilterBar";
import Pager from "../components/Pager";
import { dateLabel, money, type Expense, type Page } from "../domain";

const CATEGORIES = [
  "All",
  "Supplies",
  "Transport",
  "Stock purchases",
  "Rent",
  "Utilities",
  "Other",
];

export default function Expenses({
  page,
  loading,
  allTotal,
  category,
  setCategory,
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
  onExport,
}: {
  /** One page, plus the total of everything that matched the filters. */
  page: (Page<Expense> & { sum: number }) | null;
  loading: boolean;
  /** Every expense ever recorded, for context while a filter is narrowing. */
  allTotal: number;
  category: string;
  setCategory: (c: string) => void;
  search: string;
  setSearch: (s: string) => void;
  from: string;
  to: string;
  setRange: (from: string, to: string) => void;
  onClearFilters: () => void;
  limit: number;
  offset: number;
  setOffset: (n: number) => void;
  onOpen: (e: Expense) => void;
  onExport: (filename: string, rows: unknown[][]) => void;
}) {
  const active =
    (category !== "All" ? 1 : 0) +
    (search ? 1 : 0) +
    (from ? 1 : 0) +
    (to ? 1 : 0);
  const rows = page?.rows ?? [];
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Everyday expenses</h2>
          <p>
            {active > 0 ? (
              <>
                Matching these filters: <b>{money(page?.sum ?? 0)}</b> of{" "}
                {money(allTotal)} recorded
              </>
            ) : (
              <>Total recorded: {money(allTotal)}</>
            )}
          </p>
        </div>
        <button
          type="button"
          className="btn secondary"
          onClick={() =>
            onExport("opervia-expenses.csv", [
              ["Date", "Description", "Category", "Amount MUR"],
              ...rows.map((e) => [
                e.date,
                e.description,
                e.category,
                e.amount,
              ]),
            ])
          }
        >
          <Download size={15} />
          Export CSV
        </button>
      </div>
      <FilterBar
        search={search}
        setSearch={setSearch}
        searchLabel="Search expenses"
        from={from}
        to={to}
        setRange={setRange}
        active={active}
        onClear={onClearFilters}
      >
        <div className="filter-select">
          <label htmlFor="filter-category">Category</label>
          <select
            id="filter-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </FilterBar>
      {rows.length ? (
        <div className={"table-scroll " + (loading ? "list-loading" : "")}>
          <table className="data-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>DESCRIPTION</th>
                <th>CATEGORY</th>
                <th>AMOUNT</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>{dateLabel(e.date)}</td>
                  <td>
                    <button
                      type="button"
                      className="table-link"
                      onClick={() => onOpen(e)}
                    >
                      {e.description}
                    </button>
                  </td>
                  <td>
                    <span className="badge neutral">{e.category}</span>
                  </td>
                  <td className="number">{money(Number(e.amount))}</td>
                  <td>
                    <button
                      type="button"
                      aria-label={`Edit ${e.description}`}
                      className="icon-button"
                      onClick={() => onOpen(e)}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title={
            active > 0
              ? "No expenses match these filters"
              : "Nothing spent, nothing missed"
          }
          detail={
            active > 0
              ? "Try a wider date range, or clear the filters to see everything."
              : "Record fuel, supplies, rent, and other business expenses."
          }
        />
      )}
      <Pager
        total={page?.total ?? 0}
        limit={limit}
        offset={offset}
        onOffset={setOffset}
        noun="expenses"
      />
    </section>
  );
}
