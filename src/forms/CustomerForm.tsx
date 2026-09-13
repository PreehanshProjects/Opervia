import { useState, type FormEvent } from "react";
import { Check, Lock, Trash2 } from "lucide-react";
import NumberField from "../components/NumberField";
import { money, today, type Customer, type OpeningBalance } from "../domain";

export type OpeningInput = { amount: number; date: string; note: string };

export default function CustomerForm({
  customer,
  busy,
  onSave,
  onDelete,
  invoiceCount = 0,
  opening,
  openingSettled = 0,
}: {
  customer?: Customer;
  busy: boolean;
  onSave: (c: Customer, opening: OpeningInput) => Promise<void>;
  /** Omitted when the customer has invoices and so cannot be deleted. */
  onDelete?: () => void;
  invoiceCount?: number;
  opening?: OpeningBalance;
  /** Money already received against the opening balance; it cannot go below this. */
  openingSettled?: number;
}) {
  const [form, setForm] = useState<Customer>(
    customer ?? {
      id: crypto.randomUUID(),
      name: "",
      address: "",
      phone: "",
      email: "",
      brn: "",
    },
  );
  const [owed, setOwed] = useState<OpeningInput>({
    amount: opening?.amount ?? 0,
    date: opening?.date ?? today(),
    note: opening?.note ?? "",
  });
  return (
    <form
      className="form-body"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ ...form, name: form.name.trim() }, owed);
      }}
    >
      <p className="form-intro">
        Customer details are copied onto new invoices. Existing invoices keep
        their original details.
      </p>
      <div className="form-grid">
        {(["name", "address", "phone", "email", "brn"] as const).map((k) => (
          <label key={k} className={k === "address" ? "full" : ""}>
            {
              {
                name: "Customer name",
                address: "Address",
                phone: "Telephone",
                email: "Email address",
                brn: "Business registration no.",
              }[k]
            }
            <input
              required={k === "name"}
              maxLength={k === "address" ? 500 : 200}
              type={k === "email" ? "email" : k === "phone" ? "tel" : "text"}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          </label>
        ))}
      </div>
      {/* The migration aid: what this customer already owed when the paper book
          was closed. It is not an invoice and is never printed or sent. */}
      <div className="form-section-heading">
        <h3>Owed before Opervia</h3>
        <span>Optional</span>
      </div>
      <p className="form-intro">
        If this customer already owed you money before you started using
        Opervia, record it here. It appears on the ledger and counts toward what
        you are owed. No invoice is created and nothing is sent to the customer.
      </p>
      <div className="form-grid three">
        <label>
          Amount owed (MUR)
          <NumberField
            min="0"
            max="100000000"
            step="0.01"
            value={owed.amount}
            onValue={(amount) => setOwed({ ...owed, amount })}
          />
        </label>
        <label>
          As at
          <input
            type="date"
            max={today()}
            value={owed.date}
            onChange={(e) => setOwed({ ...owed, date: e.target.value })}
          />
        </label>
        <label>
          Note
          <input
            maxLength={200}
            placeholder="e.g. Carried over from the invoice book"
            value={owed.note}
            onChange={(e) => setOwed({ ...owed, note: e.target.value })}
          />
        </label>
      </div>
      {openingSettled > 0 && (
        <p className="footer-note">
          <Lock size={13} />
          {money(openingSettled)} has been received against this opening
          balance, so it cannot be lowered below that or removed.
        </p>
      )}
      <div className="form-footer">
        {/* Delete is offered only for an existing customer with no invoices.
            Once invoiced, the customer is part of the financial record. */}
        {customer &&
          (onDelete ? (
            <button
              type="button"
              className="text-button danger-text"
              disabled={busy}
              onClick={onDelete}
            >
              <Trash2 size={15} />
              Delete customer
            </button>
          ) : (
            <p className="footer-note">
              <Lock size={13} />
              {invoiceCount === 1
                ? "This customer has an invoice, so their details stay on record."
                : `This customer has ${invoiceCount} invoices, so their details stay on record.`}
            </p>
          ))}
        <button
          type="submit"
          className="btn primary"
          disabled={busy || !form.name.trim()}
        >
          {busy ? "Saving…" : "Save customer"}
          <Check size={16} />
        </button>
      </div>
    </form>
  );
}
