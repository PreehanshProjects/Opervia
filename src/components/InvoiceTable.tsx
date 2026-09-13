import { ChevronRight, Plus } from "lucide-react";
import Empty from "./Empty";
import {
  balance,
  dateLabel,
  money,
  status,
  type Invoice,
  type Payment,
} from "../domain";

/** The invoice list, shared by Overview (latest five) and Invoices (all). */
export default function InvoiceTable({
  invoices,
  payments,
  onOpen,
  onNew,
}: {
  invoices: Invoice[];
  payments: Payment[];
  onOpen: (i: Invoice) => void;
  onNew: () => void;
}) {
  if (!invoices.length)
    return (
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
              <td className="number">{money(i.total)}</td>
              <td className="number">{money(balance(i, payments))}</td>
              <td>
                <span className={`badge ${status(i, payments).toLowerCase()}`}>
                  {status(i, payments)}
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
