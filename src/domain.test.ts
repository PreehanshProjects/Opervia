import { describe, expect, it } from "vitest";
import {
  totals,
  validateInvoice,
  ledger,
  csvCell,
  type InvoiceInput,
  balance,
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
    expect(rows.at(-1)?.balance).toBe(
      data.invoices.reduce((s, i) => s + balance(i, data.payments), 0),
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
