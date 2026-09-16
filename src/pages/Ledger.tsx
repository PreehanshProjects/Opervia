import { Printer } from "lucide-react";
import Empty from "../components/Empty";
import OpeningPaymentForm from "../forms/OpeningPaymentForm";
import FilterBar from "../components/FilterBar";
import Pager from "../components/Pager";
import {
  dateLabel,
  money,
  type Customer,
  type LedgerMode,
  type LedgerPage,
  type OpeningBalance,
  type Payment,
} from "../domain";

const MODES: { id: LedgerMode; label: string }[] = [
  { id: "account", label: "Customer account" },
  { id: "cash", label: "Cash book" },
];

export default function Ledger({
  page,
  loading,
  limit,
  offset,
  setOffset,
  from,
  to,
  setRange,
  search,
  setSearch,
  onPrintStatement,
  customers,
  ledgerCustomer,
  setLedgerCustomer,
  mode,
  setMode,
  opening,
  openingOwed,
  busy,
  onRecordOpeningPayment,
}: {
  /** One page of entries, with every figure spanning the whole filtered set. */
  page: LedgerPage | null;
  loading: boolean;
  limit: number;
  offset: number;
  setOffset: (n: number) => void;
  from: string;
  to: string;
  setRange: (from: string, to: string) => void;
  search: string;
  setSearch: (s: string) => void;
  /** Gathers the customer's whole account itself, then opens the print sheet. */
  onPrintStatement: (c: Customer) => void;
  customers: Customer[];
  ledgerCustomer: string;
  setLedgerCustomer: (id: string) => void;
  mode: LedgerMode;
  setMode: (m: LedgerMode) => void;
  /** Only set when a single customer is selected and they owe from before. */
  opening?: OpeningBalance;
  openingOwed: number;
  busy: boolean;
  onRecordOpeningPayment: (p: Payment) => Promise<boolean>;
}) {
  const cash = mode === "cash";
  const filtered = !!(search || from || to);
  const selected = customers.find((c) => c.id === ledgerCustomer);
  return (
    <>
      <div className="ledger-modes tabs" role="group" aria-label="Ledger view">
        {MODES.map((m) => (
          <button
            type="button"
            key={m.id}
            className={mode === m.id ? "active" : ""}
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="ledger-summary">
        <div>
          <span>{cash ? "NET CASH MOVEMENT" : "CUSTOMER BALANCE"}</span>
          <h2>{money(page?.closing ?? 0)}</h2>
          <p>
            {cash
              ? "Payments received less expenses · this is not profit"
              : "Invoices less payments · expenses are in the cash book"}
          </p>
          {/* The figures the filters imply. Credits are money in and debits
              money out in both readings — only the names change. Totals of
              everything that matched, so they hold while paging through it. */}
          <dl className="ledger-figures">
            <div>
              <dt>{cash ? "Money in" : "Received"}</dt>
              <dd className="green">{money(page?.credits ?? 0)}</dd>
            </div>
            <div>
              <dt>{cash ? "Money out" : "Billed"}</dt>
              <dd>{money(page?.debits ?? 0)}</dd>
            </div>
            <div>
              <dt>{filtered ? "Entries matched" : "Entries"}</dt>
              <dd>{page?.total ?? 0}</dd>
            </div>
          </dl>
        </div>
        {cash ? (
          /* Expenses are not bought per customer, so there is nothing to filter
             by here. Saying so beats a disabled control the user has to poke. */
          <p className="ledger-scope-note">
            The whole business. Expenses are bought in bulk and belong to no one
            customer.
          </p>
        ) : (
          <div className="ledger-scope">
            <label>
              View customer
              <select
                value={ledgerCustomer}
                onChange={(e) => setLedgerCustomer(e.target.value)}
              >
                <option value="">All customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {/* A statement is one customer's account on paper. There is no such
                document for "all customers", so the action appears with the
                account it would print. */}
            {selected && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => onPrintStatement(selected)}
              >
                <Printer size={15} />
                Print statement
              </button>
            )}
          </div>
        )}
      </div>
      {opening && openingOwed > 0 && (
        <OpeningPaymentForm
          customerId={opening.customer_id}
          customerName={
            customers.find((c) => c.id === opening.customer_id)?.name ??
            "This customer"
          }
          owed={openingOwed}
          openingDate={opening.date}
          busy={busy}
          onSave={onRecordOpeningPayment}
        />
      )}
      <section className="panel">
        <FilterBar
          search={search}
          setSearch={setSearch}
          searchLabel={cash ? "Search the cash book" : "Search the ledger"}
          from={from}
          to={to}
          setRange={setRange}
          active={(search ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0)}
          onClear={() => {
            setSearch("");
            setRange("", "");
          }}
        />
        {page?.rows.length ? (
          <div className={`table-scroll ${loading ? "list-loading" : ""}`}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>ENTRY</th>
                  <th>{cash ? "MONEY OUT" : "DEBIT"}</th>
                  <th>{cash ? "MONEY IN" : "CREDIT"}</th>
                  <th>{cash ? "RUNNING NET CASH" : "RUNNING BALANCE"}</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{dateLabel(r.date)}</td>
                    <td>
                      <b>{r.label}</b>
                      <small>{r.detail}</small>
                    </td>
                    <td className="number">{r.debit ? money(r.debit) : "—"}</td>
                    <td className="number green">
                      {r.credit ? money(r.credit) : "—"}
                    </td>
                    <td className="number">
                      <b>{money(r.balance)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={
              search
                ? "Nothing matches that"
                : from || to
                  ? "Nothing in this period"
                  : "A clean page"
            }
            detail={
              search
                ? "Search looks at the entry and the line beneath it — a number, a name, a description."
                : from || to
                  ? "Try a wider date range, or clear the dates to see everything."
                  : cash
                    ? "Payments received and expenses recorded will appear here automatically."
                    : "Invoices and payments will appear here automatically."
            }
          />
        )}
        <Pager
          total={page?.total ?? 0}
          limit={limit}
          offset={offset}
          onOffset={setOffset}
          noun="entries"
        />
      </section>
    </>
  );
}
