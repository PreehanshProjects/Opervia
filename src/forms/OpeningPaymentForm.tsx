import { useState, type FormEvent } from "react";
import { Check, Plus } from "lucide-react";
import NumberField from "../components/NumberField";
import { dateLabel, money, today, type Payment } from "../domain";

/**
 * Settling what a customer owed before Opervia. Money received against an
 * opening balance is a real payment and is recorded as one, so the cash figures
 * stay correct — it simply points at the customer rather than an invoice.
 */
export default function OpeningPaymentForm({
  customerId,
  customerName,
  owed,
  openingDate,
  busy,
  onSave,
}: {
  customerId: string;
  customerName: string;
  owed: number;
  openingDate: string;
  busy: boolean;
  onSave: (p: Payment) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Payment>({
    id: crypto.randomUUID(),
    invoice_id: null,
    customer_id: customerId,
    date: today(),
    amount: owed,
    method: "Cash",
    reference: "",
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!(await onSave(form))) return;
    // Saved: close up and arm a fresh payment for whatever is still owed.
    setOpen(false);
    setForm({
      id: crypto.randomUUID(),
      invoice_id: null,
      customer_id: customerId,
      date: today(),
      amount: 0,
      method: "Cash",
      reference: "",
    });
  }

  return (
    <div className="opening-card">
      <div className="opening-head">
        <div>
          <span className="eyebrow">BEFORE OPERVIA</span>
          <h3>{money(owed)} still owed</h3>
          <p>
            {customerName} owed this when your records moved to Opervia, as at{" "}
            {dateLabel(openingDate)}.
          </p>
        </div>
        <button
          type="button"
          className="btn primary"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Plus size={16} />
          {open ? "Close payment" : "Record payment"}
        </button>
      </div>
      {open && (
        <form className="payment-form" onSubmit={(e) => void submit(e)}>
          <div className="form-grid three">
            <label>
              Amount (MUR)
              <NumberField
                required
                min="0.01"
                max={owed}
                step="0.01"
                value={form.amount}
                onValue={(amount) => setForm({ ...form, amount })}
              />
            </label>
            <label>
              Payment date
              <input
                type="date"
                required
                min={openingDate}
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
                {["Cash", "Bank transfer", "Card", "Cheque", "Other"].map(
                  (m) => (
                    <option key={m}>{m}</option>
                  ),
                )}
              </select>
            </label>
          </div>
          <label className="full">
            Reference
            <input
              maxLength={200}
              placeholder="Optional"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
            />
          </label>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Saving…" : "Save payment"}
            <Check size={16} />
          </button>
        </form>
      )}
    </div>
  );
}
