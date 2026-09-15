import {
  type Business,
  type Invoice,
  type Payment,
  money,
  dateLabel,
  lineTotal,
  paid,
  balance,
} from "./domain";
export default function InvoicePrint({
  invoice,
  business,
  payments,
  blank = false,
  mono = false,
}: {
  invoice?: Invoice;
  business: Business;
  payments: Payment[];
  blank?: boolean;
  /**
   * Ink-saving mode: the green identity drops out and the sheet is set in black
   * and grey only. A mono laser renders the tinted table head as a muddy band
   * and the brand green as an indistinct grey, so on those printers this is the
   * sheet that actually reads. It is a rendering choice, never a data one.
   */
  mono?: boolean;
}) {
  const b = invoice?.business ?? business;
  // Text details come from the invoice's own snapshot so history stays intact.
  // The logo deliberately does not: it is taken from the current profile, so an
  // image is never copied into every invoice row in the database.
  const logo = business.logo;
  return (
    <article
      className={`invoice-paper ${blank ? "blank-paper" : ""} ${
        mono ? "mono-paper" : ""
      }`}
    >
      <header className="paper-header">
        <div className="paper-identity">
          {logo && <img className="paper-logo" src={logo} alt="" />}
          <div>
            <span className="paper-eyebrow">
              {b.subtitle || "INVOICE / SALES INVOICE"}
            </span>
            <h1>{b.name}</h1>
            {b.proprietor && <p>Proprietor: {b.proprietor}</p>}
            <p>{b.address}</p>
            <p>{[b.phone, b.email].filter(Boolean).join(" · ")}</p>
            {b.brn && <p>Business registration no. {b.brn}</p>}
          </div>
        </div>
        <div className="paper-title">
          <h2>INVOICE</h2>
          <strong>
            {blank ? "No. ........................" : invoice?.number}
          </strong>
          <p>
            {blank
              ? "CASH / CREDIT SALES"
              : invoice?.voided
                ? "VOID"
                : "CASH / CREDIT SALES"}
          </p>
        </div>
      </header>
      <section className="paper-customer">
        <div>
          <span className="paper-eyebrow">BILL TO</span>
          <h3>
            {blank
              ? "Customer: ........................................................"
              : invoice?.customer.name}
          </h3>
          <p>
            {blank
              ? "Address: ............................................................"
              : invoice?.customer.address}
          </p>
          <p>
            {blank
              ? "Telephone: ........................................................."
              : invoice?.customer.phone}
          </p>
          <p>
            {blank
              ? "Business reg. no.: .............................................."
              : invoice?.customer.brn
                ? `BRN: ${invoice.customer.brn}`
                : ""}
          </p>
        </div>
        <div>
          <p>
            <b>Invoice date</b>
            <span>
              {blank ? "........................" : dateLabel(invoice!.date)}
            </span>
          </p>
          <p>
            <b>Payment due</b>
            <span>
              {blank
                ? "........................"
                : dateLabel(invoice!.due_date)}
            </span>
          </p>
        </div>
      </section>
      <table className="paper-table">
        <thead>
          <tr>
            <th>DESCRIPTION</th>
            <th>QTY</th>
            <th>UNIT</th>
            <th>UNIT PRICE</th>
            <th>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {blank
            ? Array.from({ length: 14 }, (_, i) => (
                <tr key={i}>
                  <td>&nbsp;</td>
                  <td />
                  <td />
                  <td />
                  <td />
                </tr>
              ))
            : invoice?.items.map((item, i) => (
                <tr key={i}>
                  <td>
                    {item.section && <small>{item.section} · </small>}
                    {item.description}
                  </td>
                  <td>{item.quantity}</td>
                  <td>{item.unit}</td>
                  <td>{money(item.price)}</td>
                  <td>{money(lineTotal(item))}</td>
                </tr>
              ))}
        </tbody>
      </table>
      <div className="paper-bottom">
        <div>
          <b>Notes & payment terms</b>
          <p>{invoice?.notes}</p>
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
          {!blank && (
            <>
              <p>
                <span>Subtotal</span>
                <b>{money(invoice!.subtotal)}</b>
              </p>
              {!!invoice?.tax_rate && (
                <p>
                  <span>Tax ({invoice.tax_rate}%)</span>
                  <b>{money(invoice.tax)}</b>
                </p>
              )}
            </>
          )}
          <p className="paper-grand">
            <span>Total</span>
            <b>{blank ? "........................" : money(invoice!.total)}</b>
          </p>
          <p>
            <span>Amount paid / deposit</span>
            <b>
              {blank
                ? "........................"
                : money(paid(invoice!, payments))}
            </b>
          </p>
          <p>
            <span>Balance due</span>
            <b>
              {blank
                ? "........................"
                : money(balance(invoice!, payments))}
            </b>
          </p>
        </div>
      </div>
      <footer className="paper-signatures">
        <span>Customer’s signature</span>
        <span>Signature for {b.name}</span>
      </footer>
      <div className="paper-footer">
        Thank you for your business. <span>Created with Opervia</span>
      </div>
    </article>
  );
}
