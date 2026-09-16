import Empty from "../components/Empty";
import OpeningPaymentForm from "../forms/OpeningPaymentForm";
import FilterBar from "../components/FilterBar";
import Pager from "../components/Pager";
import {
  dateLabel,
  money,
  type Customer,
  type LedgerMode,
  type LedgerRow,
  type OpeningBalance,
  type Page,
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
  /** One page of entries, with the running balance spanning the whole set. */
  page: (Page<LedgerRow> & { closing: number }) | null;
  loading: boolean;
  limit: number;
  offset: number;
  setOffset: (n: number) => void;
  from: string;
  to: string;
  setRange: (from: string, to: string) => void;
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
        </div>
        {cash ? (
          /* Expenses are not bought per customer, so there is nothing to filter
             by here. Saying so beats a disabled control the user has to poke. */
          <p className="ledger-scope-note">
            The whole business. Expenses are bought in bulk and belong to no one
            customer.
          </p>
        ) : (
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
          search=""
          setSearch={() => {}}
          searchLabel={cash ? "Search the cash book" : "Search the ledger"}
          from={from}
          to={to}
          setRange={setRange}
          active={(from ? 1 : 0) + (to ? 1 : 0)}
          onClear={() => setRange("", "")}
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
            title={from || to ? "Nothing in this period" : "A clean page"}
            detail={
              from || to
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
