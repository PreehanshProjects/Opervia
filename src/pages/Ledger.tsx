import Empty from "../components/Empty";
import OpeningPaymentForm from "../forms/OpeningPaymentForm";
import {
  dateLabel,
  money,
  type Customer,
  type ledger,
  type OpeningBalance,
  type Payment,
} from "../domain";

type LedgerRow = ReturnType<typeof ledger>[number];

export default function Ledger({
  rows,
  customers,
  ledgerCustomer,
  setLedgerCustomer,
  opening,
  openingOwed,
  busy,
  onRecordOpeningPayment,
}: {
  rows: LedgerRow[];
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
          <h2>{money(rows.at(-1)?.balance ?? 0)}</h2>
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
        {rows.length ? (
          <div className="table-scroll">
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
                {rows.map((r) => (
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
            title="A clean page"
            detail="Invoices and payments will appear here automatically."
          />
        )}
      </section>
    </>
  );
}
