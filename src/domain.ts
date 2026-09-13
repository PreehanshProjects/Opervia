import Decimal from "decimal.js";

export type Business = {
  name: string;
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
  invoice_id: string;
  date: string;
  amount: number;
  method: string;
  reference: string;
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
};
export type InvoiceInput = Pick<
  Invoice,
  "customer_id" | "date" | "due_date" | "items" | "notes" | "tax_rate"
> & { id: string; deposit: number; method: string };
export const defaultBusiness: Business = {
  name: "Your business",
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
  type: "Invoice" | "Payment" | "Expense";
  debit: number;
  credit: number;
  balance: number;
};
export function ledger(data: Data, customerId = ""): LedgerRow[] {
  const invoices = data.invoices.filter(
    (i) => !i.voided && (!customerId || i.customer_id === customerId),
  );
  const rows: Omit<LedgerRow, "balance">[] = invoices.map((i) => ({
    id: i.id,
    date: i.date,
    label: i.number,
    detail: i.customer.name,
    type: "Invoice",
    debit: i.total,
    credit: 0,
  }));
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
  let running = new Decimal(0);
  return rows
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.type === b.type
          ? a.id.localeCompare(b.id)
          : a.type === "Invoice"
            ? -1
            : 1),
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
export function downloadCsv(filename: string, rows: unknown[][]) {
  const blob = new Blob(
    ["\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
