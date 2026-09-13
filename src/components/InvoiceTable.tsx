import { ChevronRight, Plus } from "lucide-react";
import Empty from "./Empty";
import { dateLabel, money, type InvoiceRow } from "../domain";

/**
 * The invoice list, shared by Overview (latest five) and Invoices (a page).
 *
 * Balance and status arrive on the row already computed — in SQL for a live
 * workspace, in memory for the demo — so this never needs the full payment
 * history to render a single line.
 */
export default function InvoiceTable({
  invoices,
  onOpen,
  onNew,
  filtered = false,
}: {
  invoices: InvoiceRow[];
  onOpen: (i: InvoiceRow) => void;
  onNew: () => void;
  /** Changes the empty state: no matches is not the same as no invoices. */
  filtered?: boolean;
}) {
  if (!invoices.length)
    return filtered ? (
      <Empty
        title="No invoices match these filters"
        detail="Try a wider date range, or clear the filters to see everything."
      />
    ) : (
      <Empty
        title="No invoices here yet"
        detail="Create an invoice and give your paperwork a fresh start."
        action={
          <button type="button" className="btn primary" onClick={onNew}>
            <Plus size={16} />
            Create invoice
          </button>
        }
      />
    );
  return (
    <div className="table-scroll">
      <table className="data-table invoice-list-table">
        <thead>
          <tr>
            <th>INVOICE / CUSTOMER</th>
            <th>DATE</th>
            <th>AMOUNT</th>
            <th>BALANCE</th>
            <th>STATUS</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {invoices.map((i) => (
            <tr key={i.id}>
              <td>
                <button
                  type="button"
                  className="table-link"
                  onClick={() => onOpen(i)}
                >
                  {i.number}
                </button>
                <small>{i.customer.name}</small>
              </td>
              <td>{dateLabel(i.date)}</td>
              <td className="number">{money(Number(i.total))}</td>
              <td className="number">{money(Number(i.balance_due))}</td>
              <td>
                <span className={`badge ${i.derived_status.toLowerCase()}`}>
                  {i.derived_status}
                </span>
              </td>
              <td>
                <button
                  type="button"
                  aria-label={`View ${i.number}`}
                  className="icon-button"
                  onClick={() => onOpen(i)}
                >
                  <ChevronRight size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
