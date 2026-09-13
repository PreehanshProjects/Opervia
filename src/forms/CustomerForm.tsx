import { useState, type FormEvent } from "react";
import { Check, Lock, Trash2 } from "lucide-react";
import type { Customer } from "../domain";

export default function CustomerForm({
  customer,
  busy,
  onSave,
  onDelete,
  invoiceCount = 0,
}: {
  customer?: Customer;
  busy: boolean;
  onSave: (c: Customer) => Promise<void>;
  /** Omitted when the customer has invoices and so cannot be deleted. */
  onDelete?: () => void;
  invoiceCount?: number;
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
  return (
    <form
      className="form-body"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ ...form, name: form.name.trim() });
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
