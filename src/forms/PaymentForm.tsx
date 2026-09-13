import { useEffect, useRef, useState } from "react";
import NumberField from "../components/NumberField";
import { balance, dateLabel, money, today, type Invoice, type Payment } from "../domain";

export default function PaymentForm({
  invoice,
  payments,
  busy,
  onSave,
}: {
  invoice: Invoice;
  payments: Payment[];
  busy: boolean;
  onSave: (p: Payment) => Promise<void>;
}) {
  const [form, setForm] = useState<Payment>({
    id: crypto.randomUUID(),
    invoice_id: invoice.id,
    date: today(),
    amount: balance(invoice, payments),
    method: "Cash",
    reference: "",
  });
  const amountRef = useRef<HTMLInputElement>(null);
  // The form is revealed by a toggle elsewhere; move focus to the field that matters.
  useEffect(() => {
    amountRef.current?.focus();
    amountRef.current?.select();
  }, []);
  return (
    <form
      id="payment-form"
      className="payment-form"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(form);
      }}
    >
      <div className="form-grid three">
        <label>
          Amount (MUR)
          <NumberField
            ref={amountRef}
            required
            min="0.01"
            max={balance(invoice, payments)}
            step="0.01"
            value={form.amount}
            onValue={(n) => setForm({ ...form, amount: n })}
          />
        </label>
        <label>
          Payment date
          <input
            type="date"
            required
            min={invoice.date}
            max={today()}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </label>
        <label>
          Method
          <select
            value={form.method}
            onChange={(e) => setForm({ ...form, method: e.target.value })}
          >
            {["Cash", "Bank transfer", "Card", "Cheque", "Other"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>
          Reference
          <input
            maxLength={200}
            placeholder="Optional"
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
          />
        </label>
      </div>
      <button className="btn primary" disabled={busy}>
        {busy ? "Saving…" : "Save payment"}
      </button>
    </form>
  );
}
