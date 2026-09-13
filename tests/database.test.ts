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
