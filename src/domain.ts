import Decimal from "decimal.js";

export type Business = {
  name: string;
  /** Data URI of the business logo, shown on the invoice. Empty when unset. */
  logo: string;
  proprietor: string;
  subtitle: string;
  address: string;
  phone: string;
  email: string;
  brn: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  terms: string;
};
export type Customer = {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  brn: string;
};
export type Item = {
  description: string;
  quantity: number;
  unit: string;
  price: number;
  section: string;
};
export type Invoice = {
  id: string;
  number: string;
  customer_id: string;
  customer: Customer;
  business: Business;
  date: string;
  due_date: string;
  items: Item[];
  notes: string;
  tax_rate: number;
  subtotal: number;
  tax: number;
  total: number;
  voided: boolean;
};
export type Payment = {
  id: string;
  /** Set when the payment settles an invoice. Null when it settles an opening balance. */
  invoice_id: string | null;
  /** Set when the payment settles a customer opening balance. Never both. */
  customer_id?: string | null;
  date: string;
  amount: number;
  method: string;
  reference: string;
};
/** What a customer already owed before Opervia. One dated entry per customer. */
export type OpeningBalance = {
  customer_id: string;
  date: string;
  amount: number;
  note: string;
};
export type Expense = {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
};
export type Data = {
  business: Business;
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  openings: OpeningBalance[];
};
export type InvoiceInput = Pick<
  Invoice,
  "customer_id" | "date" | "due_date" | "items" | "notes" | "tax_rate"
> & { id: string; deposit: number; method: string };
export const defaultBusiness: Business = {
  name: "Your business",
  logo: "",
  proprietor: "",
  subtitle: "",
  address: "",
  phone: "",
  email: "",
  brn: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
  terms:
    "Payment is due within 30 days of the invoice date. Thank you for your business.",
};
export const emptyData = (): Data => ({
  business: { ...defaultBusiness },
  customers: [],
  invoices: [],
  payments: [],
  expenses: [],
  openings: [],
});
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function plusDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const money = (value: number) =>
  new Intl.NumberFormat("en-MU", {
    style: "currency",
    currency: "MUR",
    minimumFractionDigits: 2,
  }).format(value);
export const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
export const roundMoney = (n: Decimal.Value) =>
  new Decimal(n).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
export const lineTotal = (item: Item) =>
  roundMoney(new Decimal(item.quantity || 0).times(item.price || 0));
export function totals(items: Item[], rate = 0) {
  const subtotal = roundMoney(
    items.reduce((sum, item) => sum.plus(lineTotal(item)), new Decimal(0)),
  );
  const tax = roundMoney(new Decimal(subtotal).times(rate || 0).div(100));
  return { subtotal, tax, total: roundMoney(new Decimal(subtotal).plus(tax)) };
}
export const paid = (invoice: Invoice, payments: Payment[]) =>
  roundMoney(
    payments
      .filter((p) => p.invoice_id === invoice.id)
      .reduce((sum, p) => sum.plus(p.amount), new Decimal(0)),
  );
export const balance = (invoice: Invoice, payments: Payment[]) =>
  invoice.voided
    ? 0
    : roundMoney(new Decimal(invoice.total).minus(paid(invoice, payments)));
export function status(invoice: Invoice, payments: Payment[]) {
  if (invoice.voided) return "Void";
  if (balance(invoice, payments) <= 0) return "Paid";
  if (invoice.due_date < today()) return "Overdue";
  if (paid(invoice, payments) > 0) return "Partial";
  return "Unpaid";
}
/**
 * A customer who has been invoiced is part of the financial record and cannot be
 * removed — the same principle that lets an invoice be voided but never deleted.
 * One with no invoices is just a contact, and deleting it costs nothing.
 */
export function invoiceCountFor(customerId: string, invoices: Invoice[]) {
  return invoices.filter((i) => i.customer_id === customerId).length;
}
export function canDeleteCustomer(customerId: string, data: Data) {
  return (
    invoiceCountFor(customerId, data.invoices) === 0 &&
    !openingFor(customerId, data) &&
    !data.payments.some((p) => p.customer_id === customerId)
  );
}
export function validateInvoice(input: InvoiceInput) {
  if (!input.customer_id) throw new Error("Choose a customer.");
  if (!input.date || !input.due_date || input.due_date < input.date)
    throw new Error("Due date must be on or after the invoice date.");
  if (!input.items.length || input.items.length > 100)
    throw new Error("Add between 1 and 100 invoice items.");
  for (const item of input.items)
    if (
      !item.description.trim() ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > 1000000 ||
      !Number.isFinite(item.price) ||
      item.price < 0 ||
      item.price > 100000000 ||
      new Decimal(item.price).decimalPlaces() > 2 ||
      new Decimal(item.quantity).decimalPlaces() > 3
    )
      throw new Error(
        "Each item needs a description, a positive quantity (up to 3 decimals), and a price (up to 2 decimals).",
      );
  if (
    !Number.isFinite(input.tax_rate) ||
    input.tax_rate < 0 ||
    input.tax_rate > 100 ||
    new Decimal(input.tax_rate).decimalPlaces() > 2
  )
    throw new Error("Enter a tax rate between 0 and 100 (up to 2 decimals).");
  if (
    !Number.isFinite(input.deposit) ||
    input.deposit < 0 ||
    input.deposit > totals(input.items, input.tax_rate).total ||
    new Decimal(input.deposit).decimalPlaces() > 2
  )
    throw new Error(
      "Deposit must be between zero and the invoice total (up to 2 decimals).",
    );
  if (totals(input.items, input.tax_rate).total > 10000000000)
    throw new Error("Invoice total cannot exceed MUR 10 billion.");
  if (input.deposit > 0 && input.date > today())
    throw new Error("A deposit cannot be recorded in the future.");
}
export type LedgerRow = {
  id: string;
  date: string;
  label: string;
  detail: string;
  type: "Opening" | "Invoice" | "Payment" | "Expense";
  debit: number;
  credit: number;
  balance: number;
};
/** The opening balance recorded for a customer, if any. */
export const openingFor = (customerId: string, data: Data) =>
  data.openings.find((o) => o.customer_id === customerId);
/** Money already received against a customer's opening balance. */
export const openingPaid = (customerId: string, payments: Payment[]) =>
  roundMoney(
    payments
      .filter((p) => !p.invoice_id && p.customer_id === customerId)
      .reduce((sum, p) => sum.plus(p.amount), new Decimal(0)),
  );
/** What is still owed from before Opervia, for one customer. */
export function openingOutstanding(customerId: string, data: Data) {
  const opening = openingFor(customerId, data);
  if (!opening) return 0;
  return roundMoney(
    Decimal.max(
      new Decimal(opening.amount).minus(openingPaid(customerId, data.payments)),
      0,
    ),
  );
}
/** What every customer still owes from before Opervia. */
export const totalOpeningOutstanding = (data: Data) =>
  roundMoney(
    data.openings.reduce(
      (sum, o) => sum.plus(openingOutstanding(o.customer_id, data)),
      new Decimal(0),
    ),
  );
export function ledger(data: Data, customerId = ""): LedgerRow[] {
  const invoices = data.invoices.filter(
    (i) => !i.voided && (!customerId || i.customer_id === customerId),
  );
  const customerName = (id: string) =>
    data.customers.find((c) => c.id === id)?.name ?? "Customer";
  // Opening balances are debits that predate every Opervia invoice.
  const openings = data.openings.filter(
    (o) => !customerId || o.customer_id === customerId,
  );
  const rows: Omit<LedgerRow, "balance">[] = openings.map((o) => ({
    id: `opening-${o.customer_id}`,
    date: o.date,
    label: "Opening balance",
    detail: o.note
      ? `${customerName(o.customer_id)} · ${o.note}`
      : `${customerName(o.customer_id)} · owed before Opervia`,
    type: "Opening" as const,
    debit: o.amount,
    credit: 0,
  }));
  rows.push(
    ...invoices.map((i) => ({
      id: i.id,
      date: i.date,
      label: i.number,
      detail: i.customer.name,
      type: "Invoice" as const,
      debit: i.total,
      credit: 0,
    })),
  );
  // Payments settling an opening balance carry a customer, not an invoice.
  rows.push(
    ...data.payments
      .filter(
        (p) =>
          !p.invoice_id &&
          p.customer_id &&
          openings.some((o) => o.customer_id === p.customer_id),
      )
      .map((p) => ({
        id: p.id,
        date: p.date,
        label: "Payment received",
        detail: `Opening balance · ${p.method}`,
        type: "Payment" as const,
        debit: 0,
        credit: p.amount,
      })),
  );
  rows.push(
    ...data.payments
      .filter((p) => invoices.some((i) => i.id === p.invoice_id))
      .map((p) => ({
        id: p.id,
        date: p.date,
        label: "Payment received",
        detail: `${invoices.find((i) => i.id === p.invoice_id)?.number} · ${p.method}`,
        type: "Payment" as const,
        debit: 0,
        credit: p.amount,
      })),
  );
  // Expenses belong to the cash summary, never to a customer receivables ledger.
  // Same-day ordering is explicit so the running balance never reshuffles:
  // what was already owed, then what was billed, then what was received.
  const rank = { Opening: 0, Invoice: 1, Payment: 2, Expense: 3 } as const;
  let running = new Decimal(0);
  return rows
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        rank[a.type] - rank[b.type] ||
        a.id.localeCompare(b.id),
    )
    .map((r) => {
      running = running.plus(r.debit).minus(r.credit);
      return { ...r, balance: roundMoney(running) };
    });
}
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
/**
 * Serialises rows to CSV. Pure on purpose: delivering the file is a platform
 * concern (see lib/platform.ts), and this module stays testable in plain Node.
 * The BOM keeps Excel honest about UTF-8.
 */
export function toCsv(rows: unknown[][]) {
  return (
    "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")
  );
}
export const CSV_MIME = "text/csv;charset=utf-8";
