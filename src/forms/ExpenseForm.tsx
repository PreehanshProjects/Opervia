import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import NumberField from "../components/NumberField";
import { today, type Expense } from "../domain";

export default function ExpenseForm({
  expense,
  busy,
  onSave,
  onDelete,
}: {
  /** Set when correcting an expense already recorded. */
  expense?: Expense;
  busy: boolean;
  onSave: (e: Expense) => Promise<void>;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState<Expense>(
    expense ?? {
      id: crypto.randomUUID(),
      date: today(),
      description: "",
      category: "Supplies",
      amount: 0,
    },
  );
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
      <div className="form-footer">
        {/* An expense is a note to self, not a document someone else holds, so
            correcting or removing one is allowed. Invoices are not. */}
        {expense && onDelete && (
          <button
            type="button"
            className="text-button danger-text"
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 size={15} />
            Delete expense
          </button>
        )}
        <button
          type="submit"
          className="btn primary"
          disabled={busy || !form.description.trim()}
        >
          {busy ? "Saving…" : expense ? "Save changes" : "Save expense"}
          <Check size={16} />
        </button>
      </div>
    </form>
  );
}
