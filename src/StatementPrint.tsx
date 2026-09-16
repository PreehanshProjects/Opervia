import {
  type Business,
  type Customer,
  type LedgerRow,
  money,
  dateLabel,
  today,
} from "./domain";

/**
 * A customer's account, on the same paper as the invoice.
 *
 * It reuses the invoice sheet's own classes (`invoice-paper`, `paper-*`) rather
 * than growing a second print stylesheet: everything that was learned about
 * printing this product — A4 sizing, the repeating table head, page breaks,
 * mono mode, killing the animations that once printed the modal's opening
 * frame — already keys off those names and applies here unchanged.
 *
 * Unlike an invoice this is not a financial record. It is a statement of one
 * as it stands today, so it takes the *current* business details rather than a
 * snapshot, exactly as the blank sheet does.
 */
export default function StatementPrint({
  business,
  customer,
  rows,
  debits,
  credits,
  closing,
  from,
  to,
  mono = false,
}: {
  business: Business;
  customer: Customer;
  /** Every entry in the period, not the page that was on screen. */
  rows: LedgerRow[];
  debits: number;
  credits: number;
  /** What is owed once the period's entries are run through. */
  closing: number;
  from: string;
  to: string;
  /** Ink-saving mode, shared with the invoice sheet. */
  mono?: boolean;
}) {
  const b = business;
  const period =
    from && to
      ? `${dateLabel(from)} — ${dateLabel(to)}`
      : from
        ? `From ${dateLabel(from)}`
        : to
          ? `Up to ${dateLabel(to)}`
          : "All entries to date";
  return (
    <article className={`invoice-paper ${mono ? "mono-paper" : ""}`}>
      <header className="paper-header">
        <div className="paper-identity">
          {b.logo && <img className="paper-logo" src={b.logo} alt="" />}
          <div>
            <span className="paper-eyebrow">
              {b.subtitle || "STATEMENT OF ACCOUNT"}
            </span>
            <h1>{b.name}</h1>
            {b.proprietor && <p>Proprietor: {b.proprietor}</p>}
            <p>{b.address}</p>
            <p>{[b.phone, b.email].filter(Boolean).join(" · ")}</p>
            {b.brn && <p>Business registration no. {b.brn}</p>}
          </div>
        </div>
        <div className="paper-title">
          <h2>STATEMENT</h2>
          <strong>{dateLabel(today())}</strong>
          <p>ACCOUNT SUMMARY</p>
        </div>
      </header>
      <section className="paper-customer">
        <div>
          <span className="paper-eyebrow">STATEMENT FOR</span>
          <h3>{customer.name}</h3>
          <p>{customer.address}</p>
          <p>{customer.phone}</p>
          <p>{customer.brn ? `BRN: ${customer.brn}` : ""}</p>
        </div>
        <div>
          <p>
            <b>Period</b>
            <span>{period}</span>
          </p>
          <p>
            <b>Entries</b>
            <span>{rows.length}</span>
          </p>
        </div>
      </section>
      <table className="paper-table statement-table">
        <thead>
          <tr>
            <th>DATE</th>
            <th>DETAILS</th>
            <th>DEBIT</th>
            <th>CREDIT</th>
            <th>BALANCE</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r) => (
              <tr key={r.id}>
                <td>{dateLabel(r.date)}</td>
                <td>
                  {r.label}
                  {r.detail && <small> · {r.detail}</small>}
                </td>
                <td>{r.debit ? money(r.debit) : "—"}</td>
                <td>{r.credit ? money(r.credit) : "—"}</td>
                <td>{money(r.balance)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5}>No entries in this period.</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="paper-bottom">
        <div>
          <b>How to settle this account</b>
          <p>{b.terms}</p>
          {(b.bankName || b.accountName || b.accountNumber) && (
            <div className="paper-bank">
              <b>Bank payment details</b>
              {b.bankName && <p>Bank: {b.bankName}</p>}
              {b.accountName && <p>Account holder: {b.accountName}</p>}
              {b.accountNumber && <p>Account number: {b.accountNumber}</p>}
            </div>
          )}
        </div>
        <div className="paper-totals">
          <p>
            <span>Total invoiced</span>
            <b>{money(debits)}</b>
          </p>
          <p>
            <span>Total received</span>
            <b>{money(credits)}</b>
          </p>
          <p className="paper-grand">
            <span>Amount due</span>
            <b>{money(closing)}</b>
          </p>
        </div>
      </div>
      {/* The invoice puts two signatures here; a statement is not signed. The
          class stays because `margin-top: auto` on it is what holds the footer
          at the foot of the last page. */}
      <footer className="paper-signatures statement-note">
        <span>
          This is a statement of account, not a receipt. Please quote the
          invoice number when paying.
        </span>
      </footer>
      <div className="paper-footer">
        Thank you for your business. <span>Created with Opervia</span>
      </div>
    </article>
  );
}
