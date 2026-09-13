import { Search } from "lucide-react";
import InvoiceTable from "../components/InvoiceTable";
import type { Invoice, Payment } from "../domain";

const FILTERS = ["All", "Unpaid", "Partial", "Paid", "Overdue", "Void"];

export default function Invoices({
  invoices,
  payments,
  filter,
  setFilter,
  search,
  setSearch,
  onOpen,
  onNew,
}: {
  invoices: Invoice[];
  payments: Payment[];
  filter: string;
  setFilter: (f: string) => void;
  search: string;
  setSearch: (s: string) => void;
  onOpen: (i: Invoice) => void;
  onNew: () => void;
}) {
  return (
    <section className="panel">
      <div className="list-toolbar">
        <div
          className="tabs"
          role="group"
          aria-label="Filter invoices by status"
        >
          {FILTERS.map((f) => (
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
        <div className="search-box">
          <Search size={17} />
          <input
            aria-label="Search invoices"
            placeholder="Search invoices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <InvoiceTable
        invoices={invoices}
        payments={payments}
        onOpen={onOpen}
        onNew={onNew}
      />
    </section>
  );
}
