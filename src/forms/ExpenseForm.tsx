import { useState } from "react";
import { Check } from "lucide-react";
import NumberField from "../components/NumberField";
import { today, type Data } from "../domain";

export default function ExpenseForm({
  busy,
  onSave,
}: {
  busy: boolean;
  onSave: (e: Data["expenses"][number]) => Promise<void>;
}) {
  const [form, setForm] = useState({
    id: crypto.randomUUID(),
    date: today(),
    description: "",
    category: "Supplies",
    amount: 0,
  });
  return (
    <form
      className="form-body"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(form);
      }}
    >
      <div className="form-grid">
        <label className="full">
          Description
          <input
            maxLength={500}
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label>
          Date
          <input
            type="date"
            max={today()}
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </label>
        <label>
          Amount (MUR)
          <NumberField
            required
            min="0.01"
            max="100000000"
            step="0.01"
            value={form.amount}
            onValue={(n) => setForm({ ...form, amount: n })}
          />
        </label>
        <label>
          Category
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {[
              "Supplies",
              "Transport",
              "Stock purchases",
              "Rent",
              "Utilities",
              "Other",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="btn primary"
        disabled={busy || !form.description.trim()}
      >
        {busy ? "Saving…" : "Save expense"}
        <Check size={16} />
      </button>
    </form>
  );
}
