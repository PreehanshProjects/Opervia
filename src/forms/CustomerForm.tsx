import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import type { Customer } from "../domain";

export default function CustomerForm({
  customer,
  busy,
  onSave,
}: {
  customer?: Customer;
  busy: boolean;
  onSave: (c: Customer) => Promise<void>;
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
      <button className="btn primary" disabled={busy || !form.name.trim()}>
        {busy ? "Saving…" : "Save customer"}
        <Check size={16} />
      </button>
    </form>
  );
}
