import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import NumberField from "../components/NumberField";
import {
  clearRescuedDraft,
  readRescuedDraft,
  saveRescuedDraft,
} from "../lib/draft";
import {
  lineTotal,
  money,
  plusDays,
  roundMoney,
  today,
  totals,
  validateInvoice,
  type Data,
  type Invoice,
  type InvoiceInput,
  type Item,
} from "../domain";

/** An existing invoice, opened back up for correction. */
const toInput = (invoice: Invoice): InvoiceInput => ({
  id: invoice.id,
  customer_id: invoice.customer_id,
  date: invoice.date,
  due_date: invoice.due_date,
  items: invoice.items.map((i) => ({ ...i, section: i.section ?? "" })),
  notes: invoice.notes,
  tax_rate: invoice.tax_rate,
  // An invoice can only be edited while nothing has been paid against it, so
  // there is never an existing deposit to carry over.
  deposit: 0,
  method: "Cash",
});

export default function InvoiceForm({
  data,
  busy,
  onSave,
  onAddCustomer,
  presetCustomer,
  onPresetConsumed,
  template,
  invoice,
  onCancel,
}: {
  data: Data;
  busy: boolean;
  onSave: (i: InvoiceInput) => Promise<boolean>;
  onAddCustomer: () => void;
  presetCustomer: string;
  onPresetConsumed: () => void;
  template: InvoiceInput | null;
  /** Set to reopen an existing invoice for correction rather than create a new one. */
  invoice?: Invoice;
  /** Only shown while editing: the way back to the invoice without saving. */
  onCancel?: () => void;
}) {
  const editing = !!invoice;
  // An invoice being corrected outranks everything; then an explicit
  // "Invoice again"; then a draft rescued from an interrupted session.
  const opened = useRef(
    invoice ? toInput(invoice) : (template ?? readRescuedDraft()),
  ).current;
  const [input, setInput] = useState<InvoiceInput>(
    opened ?? {
      id: crypto.randomUUID(),
      customer_id: "",
      date: today(),
      due_date: plusDays(today(), 30),
      items: [
        { description: "", quantity: 1, unit: "pc", price: 0, section: "" },
      ],
      notes: "",
      tax_rate: 0,
      deposit: 0,
      method: "Cash",
    },
  );
  const [restored, setRestored] = useState(!!opened && !template && !editing);
  const copied = !!template;
  const [customerQuery, setCustomerQuery] = useState(
    () =>
      data.customers.find((c) => c.id === (opened?.customer_id ?? ""))?.name ??
      "",
  );
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const sums = totals(input.items, input.tax_rate);
  // A customer added from the stacked dialog is selected here on return.
  useEffect(() => {
    if (!presetCustomer) return;
    setInput((i) => ({ ...i, customer_id: presetCustomer }));
    setCustomerQuery(
      data.customers.find((c) => c.id === presetCustomer)?.name ?? "",
    );
    onPresetConsumed();
  }, [presetCustomer]);
  // Keep a rescue copy once there is real work to lose, so an expired session
  // or an accidental reload does not take the invoice with it. An edit is never
  // rescued: the invoice is already saved, and writing it to the draft slot
  // would bury a half-typed new invoice waiting there.
  const dirty =
    !!input.customer_id || input.items.some((i) => i.description.trim());
  useEffect(() => {
    if (dirty && !editing) saveRescuedDraft(input);
  }, [input, dirty, editing]);
  // What this business has billed before, most recent first. Typing a
  // description that matches brings back its unit and price.
  const priorItems = (() => {
    const seen = new Map<string, Item>();
    for (let n = data.invoices.length - 1; n >= 0; n--)
      for (const item of data.invoices[n].items) {
        const key = item.description.trim().toLowerCase();
        if (key && !seen.has(key)) seen.set(key, item);
      }
    return seen;
  })();
  function recallItem(index: number, description: string) {
    const match = priorItems.get(description.trim().toLowerCase());
    if (!match) return;
    setInput((current) => ({
      ...current,
      items: current.items.map((item, i) =>
        i === index && !item.price
          ? { ...item, description, unit: match.unit, price: match.price }
          : item,
      ),
    }));
  }
  function changeItem(index: number, key: keyof Item, value: string | number) {
    setInput({
      ...input,
      items: input.items.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    });
  }
  const blankItem: Item = {
    description: "",
    quantity: 1,
    unit: "pc",
    price: 0,
    section: "",
  };
  function addItem() {
    if (input.items.length >= 100) return;
    setInput({ ...input, items: [...input.items, blankItem] });
    // Focus the new row's description once React has painted it.
    requestAnimationFrame(() => {
      formRef.current
        ?.querySelectorAll<HTMLInputElement>(".item-description input")
        [input.items.length]?.focus();
    });
  }
  // Enter is a row break, never a submit. Creating an invoice writes an
  // immutable ledger entry, so it takes a deliberate click or Cmd/Ctrl+Enter.
  function onKeyDown(e: ReactKeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
    e.preventDefault();
    if (e.metaKey || e.ctrlKey) {
      formRef.current?.requestSubmit();
      return;
    }
    const rows = [
      ...(formRef.current?.querySelectorAll<HTMLElement>(".item-row") ?? []),
    ];
    const row = rows.findIndex((el) => el.contains(target));
    if (row === -1) return;
    if (row === rows.length - 1) addItem();
    else
      rows[row + 1]
        ?.querySelector<HTMLInputElement>(".item-description input")
        ?.focus();
  }
  return (
    <form
      ref={formRef}
      className="form-body invoice-form"
      onKeyDown={onKeyDown}
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          validateInvoice(input);
          if ((await onSave(input)) && !editing) clearRescuedDraft();
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Check the invoice details.",
          );
        }
      }}
    >
      {editing && (
        <div className="setup-note" role="status">
          <div>
            <b>Correcting {invoice.number}.</b>
            <p>
              It keeps its number and its place in the ledger. Nothing has been
              paid against it yet, which is the only reason it can still be
              changed.
            </p>
          </div>
        </div>
      )}
      {copied && (
        <div className="setup-note" role="status">
          <div>
            <b>Copied from the last invoice.</b>
            <p>
              The items, notes and tax rate carried over. Dates are today’s and
              nothing is posted until you save.
            </p>
          </div>
        </div>
      )}
      {restored && (
        <div className="setup-note" role="status">
          <div>
            <b>We kept what you had typed.</b>
            <p>
              This invoice was still open when your last session ended. Check
              the details before saving.
            </p>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              clearRescuedDraft();
              setRestored(false);
              setInput({
                id: crypto.randomUUID(),
                customer_id: "",
                date: today(),
                due_date: plusDays(today(), 30),
                items: [blankItem],
                notes: "",
                tax_rate: 0,
                deposit: 0,
                method: "Cash",
              });
            }}
          >
            <Trash2 size={14} />
            Start fresh
          </button>
        </div>
      )}
      <div className="form-grid three">
        <div className="field">
          {/* The action sits beside the label, never inside it: a button nested in
              a <label> is read as part of the field's accessible name. */}
          <div className="label-row">
            <label htmlFor="invoice-customer">Customer</label>
            {!!data.customers.length && (
              <button
                type="button"
                className="text-button"
                onClick={onAddCustomer}
              >
                <Plus size={13} />
                New
              </button>
            )}
          </div>
          {data.customers.length > 8 ? (
            <>
              {/* Past eight names a dropdown stops being findable; type to filter. */}
              <input
                id="invoice-customer"
                list="customer-names"
                required={!input.customer_id}
                placeholder="Type a customer name"
                value={customerQuery}
                onChange={(e) => {
                  setCustomerQuery(e.target.value);
                  const match = data.customers.find(
                    (c) =>
                      c.name.trim().toLowerCase() ===
                      e.target.value.trim().toLowerCase(),
                  );
                  setInput({ ...input, customer_id: match?.id ?? "" });
                }}
              />
              <datalist id="customer-names">
                {data.customers.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </>
          ) : (
            <select
              id="invoice-customer"
              required
              value={input.customer_id}
              onChange={(e) =>
                setInput({ ...input, customer_id: e.target.value })
              }
            >
              <option value="">Choose a customer</option>
              {data.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <label>
          Invoice date
          <input
            type="date"
            required
            value={input.date}
            onChange={(e) => setInput({ ...input, date: e.target.value })}
          />
        </label>
        <label>
          Due date
          <input
            type="date"
            min={input.date}
            required
            value={input.due_date}
            onChange={(e) => setInput({ ...input, due_date: e.target.value })}
          />
        </label>
      </div>
      {!data.customers.length && (
        <div className="setup-note">
          Add your first customer before creating an invoice.
          <button type="button" className="text-button" onClick={onAddCustomer}>
            Add customer <Plus size={14} />
          </button>
        </div>
      )}
      <div className="form-section-heading">
        <h3>Invoice items</h3>
        <span>All amounts in MUR</span>
      </div>
      <datalist id="prior-items">
        {[...priorItems.values()].slice(0, 200).map((item) => (
          <option key={item.description} value={item.description} />
        ))}
      </datalist>
      <div className="item-list">
        {input.items.map((item, i) => (
          <div className="item-row" key={i}>
            <label className="item-description">
              Description
              <input
                aria-label={`Item ${i + 1} description`}
                required
                maxLength={500}
                list="prior-items"
                placeholder="e.g. Roma tomatoes"
                value={item.description}
                onChange={(e) => {
                  changeItem(i, "description", e.target.value);
                  recallItem(i, e.target.value);
                }}
                onBlur={(e) => recallItem(i, e.target.value)}
              />
            </label>
            <label>
              Qty
              <NumberField
                aria-label={`Item ${i + 1} quantity`}
                min="0.001"
                max="1000000"
                step="0.001"
                required
                value={item.quantity}
                onValue={(n) => changeItem(i, "quantity", n)}
              />
            </label>
            <label>
              Unit
              <select
                aria-label={`Item ${i + 1} unit`}
                value={item.unit}
                onChange={(e) => changeItem(i, "unit", e.target.value)}
              >
                {[
                  "pc",
                  "kg",
                  "g",
                  "box",
                  "pack",
                  "litre",
                  "hour",
                  "service",
                ].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
            <label>
              Price / {item.unit}
              <NumberField
                aria-label={`Item ${i + 1} price per ${item.unit}`}
                min="0"
                max="100000000"
                step="0.01"
                required
                value={item.price}
                onValue={(n) => changeItem(i, "price", n)}
              />
            </label>
            <label className="item-section">
              Section
              <input
                aria-label={`Item ${i + 1} section`}
                maxLength={100}
                placeholder="Optional"
                value={item.section}
                onChange={(e) => changeItem(i, "section", e.target.value)}
              />
            </label>
            <div className="item-total">
              <span>Amount</span>
              <b>{money(lineTotal(item))}</b>
            </div>
            <button
              type="button"
              disabled={input.items.length === 1}
              aria-label={`Remove item ${i + 1}`}
              className="icon-button"
              onClick={() =>
                setInput({
                  ...input,
                  items: input.items.filter((_, j) => j !== i),
                })
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn secondary"
        disabled={input.items.length >= 100}
        onClick={addItem}
      >
        <Plus size={15} />
        Add item
        <small className="key-hint">Enter</small>
      </button>
      <div className="invoice-form-bottom">
        <div>
          <label>
            Notes
            <textarea
              rows={3}
              maxLength={2000}
              placeholder="A note for your customer…"
              value={input.notes}
              onChange={(e) => setInput({ ...input, notes: e.target.value })}
            />
          </label>
          <div className="form-grid">
            <label>
              Deposit received
              <NumberField
                min="0"
                max={sums.total}
                step="0.01"
                value={input.deposit}
                onValue={(n) => setInput({ ...input, deposit: n })}
              />
            </label>
            <label>
              Payment method
              <select
                value={input.method}
                onChange={(e) => setInput({ ...input, method: e.target.value })}
              >
                {["Cash", "Bank transfer", "Card", "Cheque", "Other"].map(
                  (m) => (
                    <option key={m}>{m}</option>
                  ),
                )}
              </select>
            </label>
          </div>
        </div>
        <div className="invoice-summary">
          <p>
            <span>Subtotal</span>
            <b>{money(sums.subtotal)}</b>
          </p>
          <label>
            Tax rate (%)
            <NumberField
              min="0"
              max="100"
              step="0.01"
              value={input.tax_rate}
              onValue={(n) => setInput({ ...input, tax_rate: n })}
            />
          </label>
          <p>
            <span>Tax</span>
            <b>{money(sums.tax)}</b>
          </p>
          <p className="total-line">
            <span>Total</span>
            <strong>{money(sums.total)}</strong>
          </p>
          <p>
            <span>Balance after deposit</span>
            <b>{money(roundMoney(sums.total - input.deposit))}</b>
          </p>
        </div>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="form-footer">
        <p>
          {editing
            ? "Saving replaces what is on the ledger for this invoice. Reprint it afterwards if it has already been sent."
            : "Creating an invoice posts it to the ledger. Check your details before saving."}
        </p>
        <div className="button-row">
          {editing && onCancel && (
            <button
              type="button"
              className="btn secondary"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="btn primary"
            disabled={busy || !data.customers.length}
          >
            {busy
              ? editing
                ? "Saving…"
                : "Creating…"
              : editing
                ? "Save changes"
                : "Create invoice"}
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </form>
  );
}
