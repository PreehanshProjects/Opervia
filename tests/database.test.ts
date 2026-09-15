import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
const userA = "00000000-0000-4000-8000-000000000001",
  userB = "00000000-0000-4000-8000-000000000002";
const customerA = "10000000-0000-4000-8000-000000000001",
  customerB = "10000000-0000-4000-8000-000000000002";
const inv = "20000000-0000-4000-8000-000000000001";
const invoice = (id = inv) => ({
  id,
  customer_id: customerA,
  date: "2026-01-01",
  due_date: "2026-01-31",
  items: [
    {
      description: "Herbs",
      quantity: 0.125,
      price: 60.04,
      unit: "kg",
      section: "Kitchen",
    },
  ],
  notes: "",
  tax_rate: 15,
  deposit: 2,
  method: "Cash",
});
async function asUser(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function rpc(name: string, payload: unknown) {
  return db.query(`select public.${name}($1::jsonb)`, [
    JSON.stringify(payload),
  ]);
}
beforeAll(async () => {
  await db.exec(
    "create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;",
  );
  await db.query("insert into auth.users values ($1),($2)", [userA, userB]);
  for (const file of [
    "202609130001_opervia.sql",
    "202609140001_mauritius_today.sql",
    "202609140002_opening_balances.sql",
    "202609140003_business_logo.sql",
    "202609140004_server_queries.sql",
    "202609160001_edit_and_delete_invoices.sql",
    "202609160002_expense_details_and_grants.sql",
  ])
    await db.exec(
      readFileSync(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
  await asUser(userA);
  await db.query("insert into public.business_profiles values($1,$2)", [
    userA,
    JSON.stringify({ name: "Business A", terms: "30 days" }),
  ]);
  await db.query(
    "insert into public.customers(id,owner_id,name) values($1,$2,$3)",
    [customerA, userA, "Customer A"],
  );
  await asUser(userB);
  await db.query("insert into public.business_profiles values($1,$2)", [
    userB,
    JSON.stringify({ name: "Business B" }),
  ]);
  await db.query(
    "insert into public.customers(id,owner_id,name) values($1,$2,$3)",
    [customerB, userB, "Customer B"],
  );
}, 30000);
afterAll(async () => await db.close());
describe.sequential("PostgreSQL financial rules and account isolation", () => {
  it("isolates reads and rejects a forged owner", async () => {
    await asUser(userA);
    expect(
      (await db.query("select * from public.customers")).rows,
    ).toHaveLength(1);
    await expect(
      db.query("insert into public.customers(owner_id,name) values($1,$2)", [
        userB,
        "Forged",
      ]),
    ).rejects.toThrow(/row-level security/);
    expect(
      (
        await db.query(
          "update public.customers set name=$1 where id=$2 returning id",
          ["Stolen", customerB],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("denies anonymous reads and RPC execution", async () => {
    await db.exec("reset role; set role anon");
    await expect(db.query("select * from public.customers")).rejects.toThrow(
      /permission denied/,
    );
    await expect(rpc("create_invoice", invoice())).rejects.toThrow(
      /permission denied/,
    );
  });
  it("rejects another account’s customer and direct financial writes", async () => {
    await asUser(userB);
    await expect(rpc("create_invoice", invoice())).rejects.toThrow(
      "Customer not found",
    );
    await expect(
      db.query("insert into public.invoices(id) values($1)", [inv]),
    ).rejects.toThrow(/permission denied/);
  });
  it("calculates totals on the server and atomically records deposit; retries are idempotent", async () => {
    await asUser(userA);
    await rpc("create_invoice", {
      ...invoice(),
      total: 1,
      subtotal: 1,
      owner_id: userB,
    });
    await rpc("create_invoice", invoice());
    const { rows } = await db.query<{
      total: string;
      subtotal: string;
      tax: string;
    }>("select * from public.invoices");
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].subtotal)).toBe(7.51);
    expect(Number(rows[0].tax)).toBe(1.13);
    expect(Number(rows[0].total)).toBe(8.64);
    expect((await db.query("select * from public.payments")).rows).toHaveLength(
      1,
    );
  });
  it("preserves snapshots when the customer is edited", async () => {
    await db.query(
      "update public.customers set name='Updated customer' where id=$1",
      [customerA],
    );
    const { rows } = await db.query<{ name: string }>(
      "select customer->>'name' as name from public.invoices",
    );
    expect(rows[0].name).toBe("Customer A");
  });
  it("rejects payment beyond balance and rollback leaves history intact", async () => {
    await expect(
      rpc("record_payment", {
        id: "30000000-0000-4000-8000-000000000001",
        invoice_id: inv,
        date: "2026-01-02",
        amount: 6.65,
        method: "Cash",
        reference: "",
      }),
    ).rejects.toThrow("Payment exceeds balance");
    expect((await db.query("select * from public.payments")).rows).toHaveLength(
      1,
    );
  });
  it("records exact settlement only once and blocks later payments", async () => {
    const p = {
      id: "30000000-0000-4000-8000-000000000002",
      invoice_id: inv,
      date: "2026-01-02",
      amount: 6.64,
      method: "Bank transfer",
      reference: "",
    };
    await rpc("record_payment", p);
    await rpc("record_payment", p);
    expect((await db.query("select * from public.payments")).rows).toHaveLength(
      2,
    );
    await expect(
      rpc("record_payment", {
        ...p,
        id: "30000000-0000-4000-8000-000000000003",
        amount: 0.01,
      }),
    ).rejects.toThrow("Payment exceeds balance");
    await expect(
      db.query("select public.void_invoice($1)", [inv]),
    ).rejects.toThrow("with payments");
  });
  it("blocks cross-account reads, payments and voiding", async () => {
    await asUser(userB);
    expect((await db.query("select * from public.invoices")).rows).toHaveLength(
      0,
    );
    expect((await db.query("select * from public.payments")).rows).toHaveLength(
      0,
    );
    await expect(
      rpc("record_payment", {
        id: "30000000-0000-4000-8000-000000000004",
        invoice_id: inv,
        date: "2026-01-02",
        amount: 1,
        method: "Cash",
      }),
    ).rejects.toThrow("Active invoice not found");
    await expect(
      db.query("select public.void_invoice($1)", [inv]),
    ).rejects.toThrow("Invoice not found");
  });
  it("rolls back a bad deposit and permits voiding unpaid invoices", async () => {
    await asUser(userA);
    const id = "20000000-0000-4000-8000-000000000002";
    await expect(
      rpc("create_invoice", { ...invoice(id), deposit: 9 }),
    ).rejects.toThrow("Invalid deposit");
    expect((await db.query("select * from public.invoices")).rows).toHaveLength(
      1,
    );
    await rpc("create_invoice", { ...invoice(id), deposit: 0 });
    await db.query("select public.void_invoice($1)", [id]);
    expect(
      (
        await db.query<{ voided: boolean }>(
          "select voided from public.invoices where id=$1",
          [id],
        )
      ).rows[0].voided,
    ).toBe(true);
  });
  it("validates expense precision and ownership; forbids deletion of financial history", async () => {
    await expect(
      db.query(
        "insert into public.expenses(owner_id,date,description,category,amount) values($1,'2026-01-01','Fuel','Transport',-1)",
        [userA],
      ),
    ).rejects.toThrow(/check constraint/);
    await db.query(
      "insert into public.expenses(owner_id,date,description,category,amount) values($1,'2026-01-01','Fuel','Transport',10)",
      [userA],
    );
    await expect(db.query("delete from public.invoices")).rejects.toThrow(
      /permission denied/,
    );
    await asUser(userB);
    expect((await db.query("select * from public.expenses")).rows).toHaveLength(
      0,
    );
  });
});

describe("dates are reckoned in Mauritius, not UTC", () => {
  // The app takes "today" from the device clock (UTC+4). Postgres current_date
  // is UTC. Between 00:00 and 04:00 local the two disagree by a day, and every
  // record dated today was rejected as being in the future.
  const mauritiusToday = () =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Indian/Mauritius",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

  it("opervia_today() is the Mauritius date whatever the session timezone", async () => {
    const expected = mauritiusToday();
    for (const tz of ["UTC", "Pacific/Midway", "Pacific/Kiritimati"]) {
      await db.exec(`set timezone = '${tz}'`);
      const r = await db.query<{ d: string }>(
        "select public.opervia_today()::text as d",
      );
      expect(r.rows[0].d).toBe(expected);
    }
    await db.exec("reset timezone");
  });

  it("accepts an expense dated today in Mauritius", async () => {
    await asUser(userA);
    // This is the exact insert that failed with 23514 in the early hours.
    await expect(
      db.query(
        "insert into public.expenses(owner_id,date,description,category,amount) values($1,public.opervia_today(),$2,$3,$4)",
        [userA, "Late night fuel", "Transport", 250],
      ),
    ).resolves.toBeDefined();
  });

  it("still refuses an expense dated tomorrow", async () => {
    await asUser(userA);
    await expect(
      db.query(
        "insert into public.expenses(owner_id,date,description,category,amount) values($1,public.opervia_today()+1,$2,$3,$4)",
        [userA, "Future fuel", "Transport", 250],
      ),
    ).rejects.toThrow(/expenses_date_check/);
  });

  it("accepts a payment dated today in Mauritius", async () => {
    await asUser(userA);
    const id = "20000000-0000-4000-8000-000000000090";
    await rpc("create_invoice", {
      ...invoice(id),
      date: "2026-01-01",
      deposit: 0,
    });
    const today = mauritiusToday();
    await expect(
      rpc("record_payment", {
        id: "30000000-0000-4000-8000-000000000090",
        invoice_id: id,
        date: today,
        amount: 1,
        method: "Cash",
        reference: "",
      }),
    ).resolves.toBeDefined();
  });
});

describe("opening balances", () => {
  const openingCustomer = "10000000-0000-4000-8000-000000000050";

  beforeAll(async () => {
    await asUser(userA);
    await db.query(
      "insert into public.customers(id,owner_id,name) values($1,$2,$3)",
      [openingCustomer, userA, "Carried Over Ltd"],
    );
  });

  it("records what a customer owed before Opervia", async () => {
    await asUser(userA);
    await rpc("save_opening_balance", {
      customer_id: openingCustomer,
      date: "2026-01-01",
      amount: 12400,
      note: "From the book",
    });
    const r = await db.query<{ amount: string }>(
      "select amount::text from public.opening_balances where customer_id=$1",
      [openingCustomer],
    );
    expect(r.rows[0].amount).toBe("12400");
  });

  it("refuses an opening balance for another owner's customer", async () => {
    await asUser(userB);
    await expect(
      rpc("save_opening_balance", {
        customer_id: openingCustomer,
        date: "2026-01-01",
        amount: 50,
        note: "",
      }),
    ).rejects.toThrow(/Customer not found/);
  });

  it("settles an opening balance with a real payment", async () => {
    await asUser(userA);
    await rpc("record_payment", {
      id: "30000000-0000-4000-8000-000000000050",
      customer_id: openingCustomer,
      date: "2026-02-01",
      amount: 5000,
      method: "Cash",
      reference: "",
    });
    const r = await db.query<{ amount: string; invoice_id: string | null }>(
      "select amount::text, invoice_id from public.payments where customer_id=$1",
      [openingCustomer],
    );
    expect(r.rows).toHaveLength(1);
    // It is a payment like any other, so the cash figures stay correct.
    expect(r.rows[0].amount).toBe("5000");
    expect(r.rows[0].invoice_id).toBeNull();
  });

  it("refuses a payment larger than what is still owed", async () => {
    await asUser(userA);
    await expect(
      rpc("record_payment", {
        id: "30000000-0000-4000-8000-000000000051",
        customer_id: openingCustomer,
        date: "2026-02-02",
        amount: 7400.01,
        method: "Cash",
        reference: "",
      }),
    ).rejects.toThrow(/exceeds the opening balance/);
  });

  it("refuses to lower the opening balance below what has been settled", async () => {
    await asUser(userA);
    await expect(
      rpc("save_opening_balance", {
        customer_id: openingCustomer,
        date: "2026-01-01",
        amount: 4000,
        note: "",
      }),
    ).rejects.toThrow(/cannot be less than the payments/);
  });

  it("refuses to remove an opening balance that has been part-settled", async () => {
    await asUser(userA);
    await expect(
      rpc("save_opening_balance", {
        customer_id: openingCustomer,
        date: "2026-01-01",
        amount: 0,
        note: "",
      }),
    ).rejects.toThrow(/cannot be removed/);
  });

  it("refuses an opening date in the future", async () => {
    await asUser(userA);
    await expect(
      rpc("save_opening_balance", {
        customer_id: customerA,
        date: "2099-01-01",
        amount: 10,
        note: "",
      }),
    ).rejects.toThrow(/cannot be in the future/);
  });

  it("keeps a payment from settling an invoice and an opening balance at once", async () => {
    const insert = [
      "insert into public.payments(id,owner_id,invoice_id,customer_id,date,amount,method) values($1,$2,$3,$4,$5,$6,$7)",
      [
        "30000000-0000-4000-8000-000000000052",
        userA,
        inv,
        openingCustomer,
        "2026-02-02",
        1,
        "Cash",
      ],
    ] as const;
    // The browser role cannot write payments at all; only the RPC may.
    await asUser(userA);
    await expect(db.query(insert[0], [...insert[1]])).rejects.toThrow(
      /permission denied/,
    );
    // And even with table rights, the two targets are mutually exclusive.
    await db.exec("reset role");
    await expect(db.query(insert[0], [...insert[1]])).rejects.toThrow(
      /payments_one_target/,
    );
  });

  it("clears an untouched opening balance", async () => {
    await asUser(userA);
    await rpc("save_opening_balance", {
      customer_id: customerA,
      date: "2026-01-01",
      amount: 900,
      note: "",
    });
    await rpc("save_opening_balance", {
      customer_id: customerA,
      date: "2026-01-01",
      amount: 0,
      note: "",
    });
    const r = await db.query(
      "select 1 from public.opening_balances where customer_id=$1",
      [customerA],
    );
    expect(r.rows).toHaveLength(0);
  });
});

describe("business logo", () => {
  it("keeps the logo out of the invoice snapshot", async () => {
    await asUser(userA);
    const logo = "data:image/png;base64," + "A".repeat(2000);
    await db.query(
      "update public.business_profiles set details = details || $1::jsonb where owner_id=$2",
      [JSON.stringify({ logo }), userA],
    );
    const id = "20000000-0000-4000-8000-000000000099";
    await rpc("create_invoice", { ...invoice(id), deposit: 0 });
    const r = await db.query<{ has_logo: boolean }>(
      "select (business ? 'logo') as has_logo from public.invoices where id=$1",
      [id],
    );
    // Branding is not a financial fact, and one image per invoice would bloat the table.
    expect(r.rows[0].has_logo).toBe(false);
  });

  it("refuses a logo larger than the stored cap", async () => {
    await asUser(userA);
    await expect(
      db.query(
        "update public.business_profiles set details = details || $1::jsonb where owner_id=$2",
        [JSON.stringify({ logo: "x".repeat(100001) }), userA],
      ),
    ).rejects.toThrow(/business_profiles_logo_size/);
  });
});

describe("server-side queries", () => {
  const qCust = "10000000-0000-4000-8000-000000000060";
  const ids = (n: number) =>
    `20000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;

  beforeAll(async () => {
    await asUser(userA);
    await db.query(
      "insert into public.customers(id,owner_id,name) values($1,$2,$3)",
      [qCust, userA, "Query Customer"],
    );
    // Twelve invoices on distinct dates, so paging boundaries are unambiguous.
    for (let n = 1; n <= 12; n++)
      await rpc("create_invoice", {
        id: ids(n),
        customer_id: qCust,
        date: `2026-03-${String(n).padStart(2, "0")}`,
        due_date: `2026-04-${String(n).padStart(2, "0")}`,
        items: [
          {
            description: `Item ${n}`,
            quantity: 1,
            price: 100,
            unit: "pc",
            section: "",
          },
        ],
        notes: "",
        tax_rate: 0,
        deposit: 0,
        method: "Cash",
      });
  }, 30000);

  const call = async (fn: string, payload: unknown = {}) => {
    const r = await db.query<Record<string, unknown>>(
      `select public.${fn}($1::jsonb) as out`,
      [JSON.stringify(payload)],
    );
    return r.rows[0].out as {
      total: number;
      rows: Record<string, unknown>[];
      closing?: number;
      sum?: number;
    };
  };

  it("pages invoices and reports the true total, not the page size", async () => {
    await asUser(userA);
    const page1 = await call("list_invoices", { customer_id: qCust, limit: 5 });
    expect(page1.total).toBe(12);
    expect(page1.rows).toHaveLength(5);
    const page3 = await call("list_invoices", {
      customer_id: qCust,
      limit: 5,
      offset: 10,
    });
    expect(page3.total).toBe(12);
    expect(page3.rows).toHaveLength(2);
    // Newest first, and no row appears on two pages.
    const all = [...page1.rows, ...page3.rows].map((r) => r.number);
    expect(new Set(all).size).toBe(all.length);
  });

  it("filters invoices by derived status, date range and search", async () => {
    await asUser(userA);
    expect((await call("list_invoices", { status: "Void" })).total).toBe(1);
    const ranged = await call("list_invoices", {
      customer_id: qCust,
      from: "2026-03-03",
      to: "2026-03-05",
    });
    expect(ranged.total).toBe(3);
    const searched = await call("list_invoices", { search: "Query Customer" });
    expect(searched.total).toBe(12);
    expect(
      (await call("list_invoices", { search: "no-such-thing" })).total,
    ).toBe(0);
  });

  it("carries the ledger running balance across page boundaries", async () => {
    await asUser(userA);
    const whole = await call("list_ledger", { customer_id: qCust, limit: 500 });
    expect(whole.total).toBe(12);
    // Twelve invoices of 100 each, so the balance climbs 100 at a time.
    expect(whole.rows.map((r) => Number(r.balance))).toEqual(
      Array.from({ length: 12 }, (_, i) => (i + 1) * 100),
    );
    // The page-two balance must continue, not restart at zero.
    const page2 = await call("list_ledger", {
      customer_id: qCust,
      limit: 5,
      offset: 5,
    });
    expect(Number(page2.rows[0].balance)).toBe(600);
    expect(page2.total).toBe(12);
    expect(Number(whole.closing)).toBe(1200);
  });

  it("summarises the whole workspace regardless of paging", async () => {
    await asUser(userA);
    const s = (
      await db.query<{ out: Record<string, number> }>(
        "select public.workspace_summary() as out",
      )
    ).rows[0].out;
    // 12 unpaid invoices of 100 for the query customer, plus earlier fixtures.
    expect(s.invoiceOutstanding).toBeGreaterThanOrEqual(1200);
    expect(s.unpaidCount).toBeGreaterThanOrEqual(12);
    expect(s.received).toBeGreaterThan(0);
    expect(typeof s.expenses).toBe("number");
  });

  it("never returns another account's records", async () => {
    await asUser(userB);
    expect((await call("list_invoices", { customer_id: qCust })).total).toBe(0);
    expect((await call("list_ledger", { customer_id: qCust })).total).toBe(0);
    expect((await call("list_expenses")).total).toBe(0);
  });
});

describe.sequential("correcting and removing invoices", () => {
  // Own fixtures throughout: these tests delete rows, and the suites above
  // count what is on the table.
  const cust = "10000000-0000-4000-8000-00000000000e";
  const editable = "20000000-0000-4000-8000-00000000000e";
  const settled = "20000000-0000-4000-8000-00000000000f";
  const draft = (id: string) => ({
    id,
    customer_id: cust,
    date: "2026-01-01",
    due_date: "2026-01-31",
    items: [
      {
        description: "Lettuce",
        quantity: 2,
        price: 100,
        unit: "pc",
        section: "",
      },
    ],
    notes: "",
    tax_rate: 0,
    deposit: 0,
    method: "Cash",
  });
  beforeAll(async () => {
    await asUser(userA);
    await db.query(
      "insert into public.customers(id,owner_id,name) values($1,$2,$3)",
      [cust, userA, "Edit Test Ltd"],
    );
    await rpc("create_invoice", draft(editable));
    await rpc("create_invoice", { ...draft(settled), deposit: 50 });
  });

  it("rewrites an unpaid invoice without changing its number", async () => {
    const before = (
      await db.query<{ number: string }>(
        "select number from public.invoices where id=$1",
        [editable],
      )
    ).rows[0].number;
    await rpc("update_invoice", {
      ...draft(editable),
      items: [
        {
          description: "Tomatoes",
          quantity: 3,
          price: 40,
          unit: "kg",
          section: "",
        },
      ],
      tax_rate: 15,
      notes: "Corrected",
    });
    const { rows } = await db.query<{
      number: string;
      subtotal: string;
      tax: string;
      total: string;
      notes: string;
    }>("select * from public.invoices where id=$1", [editable]);
    expect(rows[0].number).toBe(before);
    expect(Number(rows[0].subtotal)).toBe(120);
    expect(Number(rows[0].tax)).toBe(18);
    expect(Number(rows[0].total)).toBe(138);
    expect(rows[0].notes).toBe("Corrected");
  });

  it("keeps the logo out of the refreshed snapshot", async () => {
    await db.query(
      "update public.business_profiles set details = details || $2::jsonb where owner_id=$1",
      [userA, JSON.stringify({ logo: "data:image/png;base64,AAAA" })],
    );
    await rpc("update_invoice", draft(editable));
    const { rows } = await db.query<{ has: boolean }>(
      "select business ? 'logo' as has from public.invoices where id=$1",
      [editable],
    );
    expect(rows[0].has).toBe(false);
  });

  it("refuses to edit or delete an invoice once money has moved", async () => {
    await expect(rpc("update_invoice", draft(settled))).rejects.toThrow(
      "cannot be edited",
    );
    await expect(
      db.query("select public.delete_invoice($1)", [settled]),
    ).rejects.toThrow("cannot be deleted");
  });

  it("refuses to edit a voided invoice, but allows deleting one", async () => {
    const voided = "20000000-0000-4000-8000-00000000001a";
    await rpc("create_invoice", draft(voided));
    await db.query("select public.void_invoice($1)", [voided]);
    await expect(rpc("update_invoice", draft(voided))).rejects.toThrow(
      "voided invoice cannot be edited",
    );
    await db.query("select public.delete_invoice($1)", [voided]);
    expect(
      (await db.query("select 1 from public.invoices where id=$1", [voided]))
        .rows,
    ).toHaveLength(0);
  });

  it("applies the same validation as creating", async () => {
    await expect(
      rpc("update_invoice", { ...draft(editable), tax_rate: 150 }),
    ).rejects.toThrow("Invalid tax rate");
    await expect(
      rpc("update_invoice", { ...draft(editable), due_date: "2025-12-01" }),
    ).rejects.toThrow("Invalid invoice dates");
    await expect(
      rpc("update_invoice", { ...draft(editable), items: [] }),
    ).rejects.toThrow("between 1 and 100");
  });

  it("will not let one account edit or delete another's invoice", async () => {
    await asUser(userB);
    await expect(rpc("update_invoice", draft(editable))).rejects.toThrow(
      "Invoice not found",
    );
    await expect(
      db.query("select public.delete_invoice($1)", [editable]),
    ).rejects.toThrow("Invoice not found");
  });

  it("removes an unpaid invoice outright, leaving a gap in the numbering", async () => {
    await asUser(userA);
    await db.query("select public.delete_invoice($1)", [editable]);
    expect(
      (await db.query("select 1 from public.invoices where id=$1", [editable]))
        .rows,
    ).toHaveLength(0);
    // The sequence never rewinds, so the next invoice does not reuse the number.
    const next = "20000000-0000-4000-8000-00000000001b";
    await rpc("create_invoice", draft(next));
    const numbers = (
      await db.query<{ number: string }>(
        "select number from public.invoices where id in ($1,$2)",
        [settled, next],
      )
    ).rows.map((r) => Number(r.number.replace("OP-", "")));
    expect(Math.max(...numbers) - Math.min(...numbers)).toBeGreaterThan(1);
  });
});

describe.sequential("expenses: the grants the app always needed", () => {
  it("records an expense through an upsert, which needs UPDATE as well as INSERT", async () => {
    await asUser(userA);
    const id = "40000000-0000-4000-8000-00000000000a";
    // This is the shape PostgREST sends for .upsert(): the path that used to
    // fail with "permission denied" on a brand-new row.
    const upsert = (amount: number, note: string) =>
      db.query(
        `insert into public.expenses(id,owner_id,date,description,note,category,amount)
         values($1,$2,'2026-01-05','Delivery fuel',$3,'Transport',$4)
         on conflict (id) do update set amount=excluded.amount, note=excluded.note`,
        [id, userA, note, amount],
      );
    await upsert(650, "Vacoas run");
    await upsert(777, "Vacoas run, receipt 4417");
    const { rows } = await db.query<{ amount: string; note: string }>(
      "select amount, note from public.expenses where id=$1",
      [id],
    );
    expect(Number(rows[0].amount)).toBe(777);
    expect(rows[0].note).toBe("Vacoas run, receipt 4417");
    // And the optional line is searchable alongside the description.
    const { rows: found } = await db.query<{ out: { total: number } }>(
      "select public.list_expenses($1::jsonb) as out",
      [JSON.stringify({ search: "4417" })],
    );
    expect(found[0].out.total).toBe(1);
    await db.query("delete from public.expenses where id=$1", [id]);
  });

  it("lets an owner delete their own customer, and no one else's", async () => {
    const spare = "10000000-0000-4000-8000-00000000000d";
    await db.query(
      "insert into public.customers(id,owner_id,name) values($1,$2,$3)",
      [spare, userA, "Temporary Trader"],
    );
    await asUser(userB);
    expect(
      (await db.query("delete from public.customers where id=$1", [spare]))
        .affectedRows,
    ).toBe(0);
    await asUser(userA);
    await db.query("delete from public.customers where id=$1", [spare]);
    expect(
      (await db.query("select 1 from public.customers where id=$1", [spare]))
        .rows,
    ).toHaveLength(0);
  });

  it("still refuses to delete a customer who has invoices", async () => {
    await expect(
      db.query("delete from public.customers where id=$1", [customerA]),
    ).rejects.toThrow(/foreign key/);
  });
});
