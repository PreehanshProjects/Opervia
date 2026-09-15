import { describe, expect, it } from "vitest";
import {
  totals,
  validateInvoice,
  ledger,
  csvCell,
  type InvoiceInput,
  balance,
  emptyData,
  openingOutstanding,
  openingPaid,
  totalOpeningOutstanding,
  canDeleteCustomer,
  queryInvoices,
  queryLedger,
  summarise,
} from "./domain";
import { makeDemo } from "./demo";
describe("invoice calculations", () => {
  it("rounds each fractional line and tax with decimal half-up rounding", () => {
    expect(
      totals(
        [
          {
            description: "Herbs",
            quantity: 0.125,
            price: 60.04,
            unit: "kg",
            section: "",
          },
        ],
        15,
      ),
    ).toEqual({ subtotal: 7.51, tax: 1.13, total: 8.64 });
    expect(
      totals([
        { description: "x", quantity: 1, price: 0.1, unit: "pc", section: "" },
        { description: "y", quantity: 1, price: 0.2, unit: "pc", section: "" },
      ]).total,
    ).toBe(0.3);
  });
  it("rejects negative quantities, overpayment and invalid dates", () => {
    const input: InvoiceInput = {
      id: "x",
      customer_id: "c",
      date: "2026-09-01",
      due_date: "2026-09-30",
      items: [
        { description: "x", quantity: 1, price: 10, unit: "pc", section: "" },
      ],
      tax_rate: 0,
      notes: "",
      deposit: 0,
      method: "Cash",
    };
    expect(() => validateInvoice({ ...input, deposit: 11 })).toThrow("Deposit");
    expect(() => validateInvoice({ ...input, due_date: "2026-08-01" })).toThrow(
      "Due date",
    );
    expect(() =>
      validateInvoice({
        ...input,
        items: [{ ...input.items[0], quantity: -1 }],
      }),
    ).toThrow("positive quantity");
  });
  it("keeps expenses out of receivables and excludes void invoices", () => {
    const data = makeDemo();
    const rows = ledger(data);
    // Receivables are unpaid invoices plus whatever was owed before Opervia.
    expect(rows.at(-1)?.balance).toBe(
      data.invoices.reduce((s, i) => s + balance(i, data.payments), 0) +
        totalOpeningOutstanding(data),
    );
    const customerRows = ledger(data, data.customers[1].id);
    expect(customerRows.at(-1)?.balance).toBe(0);
    data.invoices[2].voided = true;
    expect(ledger(data).some((r) => r.id === data.invoices[2].id)).toBe(false);
  });
  it("escapes CSV cells and prevents spreadsheet formula injection", () => {
    expect(csvCell('=HYPERLINK("evil")')).toBe('"\'=HYPERLINK(""evil"")"');
    expect(csvCell("a,b")).toBe('"a,b"');
  });
});

describe("opening balances", () => {
  const base = () => {
    const d = emptyData();
    d.customers = [
      {
        id: "c1",
        name: "Coastal Kitchen",
        address: "",
        phone: "",
        email: "",
        brn: "",
      },
      {
        id: "c2",
        name: "The Garden Café",
        address: "",
        phone: "",
        email: "",
        brn: "",
      },
    ];
    d.openings = [
      {
        customer_id: "c1",
        date: "2026-01-01",
        amount: 12400,
        note: "From the book",
      },
    ];
    return d;
  };

  it("counts what was owed before Opervia as still outstanding", () => {
    const d = base();
    expect(openingOutstanding("c1", d)).toBe(12400);
    expect(openingOutstanding("c2", d)).toBe(0);
    expect(totalOpeningOutstanding(d)).toBe(12400);
  });

  it("reduces the opening balance by payments made against it", () => {
    const d = base();
    d.payments = [
      {
        id: "p1",
        invoice_id: null,
        customer_id: "c1",
        date: "2026-02-01",
        amount: 5000,
        method: "Cash",
        reference: "",
      },
    ];
    expect(openingPaid("c1", d.payments)).toBe(5000);
    expect(openingOutstanding("c1", d)).toBe(7400);
    expect(totalOpeningOutstanding(d)).toBe(7400);
  });

  it("never reports a negative opening balance", () => {
    const d = base();
    d.payments = [
      {
        id: "p1",
        invoice_id: null,
        customer_id: "c1",
        date: "2026-02-01",
        amount: 12400,
        method: "Cash",
        reference: "",
      },
    ];
    expect(openingOutstanding("c1", d)).toBe(0);
  });

  it("opens the ledger with the opening balance and settles it in order", () => {
    const d = base();
    d.payments = [
      {
        id: "p1",
        invoice_id: null,
        customer_id: "c1",
        date: "2026-02-01",
        amount: 5000,
        method: "Cash",
        reference: "",
      },
    ];
    const rows = ledger(d, "c1");
    expect(rows.map((r) => [r.type, r.debit, r.credit, r.balance])).toEqual([
      ["Opening", 12400, 0, 12400],
      ["Payment", 0, 5000, 7400],
    ]);
    expect(rows[0].label).toBe("Opening balance");
  });

  it("puts the opening balance before an invoice raised the same day", () => {
    const d = base();
    d.openings = [
      { customer_id: "c1", date: "2026-01-01", amount: 100, note: "" },
    ];
    d.invoices = [
      {
        id: "i1",
        number: "OP-1001",
        customer_id: "c1",
        customer: d.customers[0],
        business: d.business,
        date: "2026-01-01",
        due_date: "2026-01-31",
        items: [],
        notes: "",
        tax_rate: 0,
        subtotal: 40,
        tax: 0,
        total: 40,
        voided: false,
      },
    ];
    expect(ledger(d, "c1").map((r) => r.type)).toEqual(["Opening", "Invoice"]);
    expect(ledger(d, "c1").at(-1)?.balance).toBe(140);
  });

  it("keeps a customer with an opening balance out of reach of deletion", () => {
    const d = base();
    expect(canDeleteCustomer("c1", d, 0)).toBe(false);
    expect(canDeleteCustomer("c2", d, 0)).toBe(true);
    // And one with invoices, however clean the rest of their record.
    expect(canDeleteCustomer("c2", d, 1)).toBe(false);
  });
});

describe("queries (the in-memory mirror of the SQL functions)", () => {
  const build = () => {
    const d = emptyData();
    d.customers = [
      {
        id: "c1",
        name: "Alpha Ltd",
        address: "",
        phone: "",
        email: "",
        brn: "",
      },
      { id: "c2", name: "Beta Co", address: "", phone: "", email: "", brn: "" },
    ];
    d.invoices = Array.from({ length: 12 }, (_, n) => ({
      id: `i${n + 1}`,
      number: `OP-${1001 + n}`,
      customer_id: n % 2 ? "c2" : "c1",
      customer: d.customers[n % 2],
      business: d.business,
      date: `2026-03-${String(n + 1).padStart(2, "0")}`,
      due_date: `2026-04-${String(n + 1).padStart(2, "0")}`,
      items: [],
      notes: "",
      tax_rate: 0,
      subtotal: 100,
      tax: 0,
      total: 100,
      voided: false,
    }));
    return d;
  };

  it("reports the true total, not the size of the page", () => {
    const d = build();
    const first = queryInvoices(d, { limit: 5 });
    expect(first.total).toBe(12);
    expect(first.rows).toHaveLength(5);
    const last = queryInvoices(d, { limit: 5, offset: 10 });
    expect(last.total).toBe(12);
    expect(last.rows).toHaveLength(2);
  });

  it("pages without repeating or dropping a row", () => {
    const d = build();
    const seen = [0, 5, 10].flatMap(
      (offset) => queryInvoices(d, { limit: 5, offset }).rows,
    );
    expect(seen).toHaveLength(12);
    expect(new Set(seen.map((i) => i.id)).size).toBe(12);
  });

  it("filters by customer, date range and search", () => {
    const d = build();
    expect(queryInvoices(d, { customer_id: "c1", limit: 50 }).total).toBe(6);
    expect(
      queryInvoices(d, { from: "2026-03-03", to: "2026-03-05", limit: 50 })
        .total,
    ).toBe(3);
    expect(queryInvoices(d, { search: "beta", limit: 50 }).total).toBe(6);
    expect(queryInvoices(d, { search: "nothing", limit: 50 }).total).toBe(0);
  });

  it("keeps the ledger running balance continuous across pages", () => {
    const d = build();
    const whole = queryLedger(d, { customer_id: "c1", limit: 500 });
    expect(whole.rows.map((r) => r.balance)).toEqual([
      100, 200, 300, 400, 500, 600,
    ]);
    // The second page must continue the balance, not restart it.
    const second = queryLedger(d, { customer_id: "c1", limit: 3, offset: 3 });
    expect(second.rows[0].balance).toBe(400);
    expect(second.total).toBe(6);
    expect(whole.closing).toBe(600);
  });

  it("summarises the whole workspace, not the visible page", () => {
    const d = build();
    const s = summarise(d);
    expect(s.invoiceOutstanding).toBe(1200);
    expect(s.unpaidCount).toBe(12);
    expect(s.invoiceCount).toBe(12);
    // A page of five must not change any total.
    expect(queryInvoices(d, { limit: 5 }).total).toBe(s.invoiceCount);
  });

  it("excludes voided invoices from totals but still lists them", () => {
    const d = build();
    d.invoices[0].voided = true;
    expect(summarise(d).invoiceOutstanding).toBe(1100);
    expect(queryInvoices(d, { status: "Void", limit: 50 }).total).toBe(1);
    expect(queryLedger(d, { limit: 500 }).total).toBe(11);
  });
});
