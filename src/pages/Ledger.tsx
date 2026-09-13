import Empty from "../components/Empty";
import OpeningPaymentForm from "../forms/OpeningPaymentForm";
import FilterBar from "../components/FilterBar";
import Pager from "../components/Pager";
import {
  dateLabel,
  money,
  type Customer,
  type LedgerRow,
  type OpeningBalance,
  type Page,
  type Payment,
} from "../domain";

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
  /** Only set when a single customer is selected and they owe from before. */
  opening?: OpeningBalance;
  openingOwed: number;
  busy: boolean;
  onRecordOpeningPayment: (p: Payment) => Promise<boolean>;
}) {
  return (
    <>
      <div className="ledger-summary">
        <div>
          <span>CUSTOMER BALANCE</span>
          <h2>{money(page?.closing ?? 0)}</h2>
          <p>Invoices less payments · expenses shown separately</p>
        </div>
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
          searchLabel="Search the ledger"
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
                  <th>DEBIT</th>
                  <th>CREDIT</th>
                  <th>RUNNING BALANCE</th>
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
