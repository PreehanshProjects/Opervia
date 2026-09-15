import { createClient } from "@supabase/supabase-js";
import { Preferences } from "@capacitor/preferences";
import { isNative } from "./lib/platform";
import type {
  Business,
  Customer,
  Data,
  Expense,
  ExpenseQuery,
  Invoice,
  InvoiceInput,
  InvoiceRow,
  InvoiceQuery,
  LedgerQuery,
  LedgerRow,
  Page,
  Payment,
  Summary,
} from "./domain";
import { defaultBusiness } from "./domain";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (key && !(key.startsWith("sb_publishable_") || key.startsWith("eyJ")))
  throw new Error("Use a Supabase publishable key, never a secret key.");
// A WebView can evict localStorage, which would silently sign the owner out
// mid-day. Native builds persist the session through the OS instead. Web is
// left on localStorage exactly as before, so existing sessions keep working.
const nativeAuthStorage = {
  getItem: async (k: string) => (await Preferences.get({ key: k })).value,
  setItem: (k: string, v: string) => Preferences.set({ key: k, value: v }),
  removeItem: (k: string) => Preferences.remove({ key: k }),
};

export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // On native the session arrives via a deep link we handle ourselves.
          detectSessionInUrl: !isNative(),
          flowType: "pkce",
          ...(isNative() ? { storage: nativeAuthStorage } : {}),
        },
      })
    : null;
function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
/**
 * Reference data: the things every screen needs and that stay small — the
 * business profile, the customer list and opening balances.
 *
 * Transactions are deliberately NOT loaded here. Invoices, payments and
 * expenses are queried per view through the paging RPCs, so a workspace with
 * years of history costs the same to open as an empty one.
 */
export async function loadReference(): Promise<Data> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const [business, customers, openings] = await Promise.all(
    ["business_profiles", "customers", "opening_balances"].map(
      async (table) => {
        const rows: Record<string, unknown>[] = [];
        for (let offset = 0; offset < 20000;) {
          const { data, error } = await supabase!
            .from(table)
            .select("*")
            .order(
              table === "business_profiles"
                ? "owner_id"
                : table === "opening_balances"
                  ? "customer_id"
                  : "name",
            )
            .range(offset, offset + 499);
          check(error);
          if (!data?.length) return rows;
          rows.push(...data);
          offset += data.length;
        }
        throw new Error(
          "Customer limit reached. Export and archive records before continuing.",
        );
      },
    ),
  );
  return {
    business: {
      ...defaultBusiness,
      ...((business[0]?.details as Partial<Business>) ?? {}),
    },
    customers,
    openings,
    invoices: [],
    payments: [],
    expenses: [],
  } as unknown as Data;
}

async function query<T>(fn: string, payload: unknown): Promise<T> {
  const { data, error } = await supabase!.rpc(fn, { payload });
  check(error);
  return data as T;
}
/** One page of invoices, filtered and counted on the server. */
export const listInvoices = (q: InvoiceQuery) =>
  query<Page<InvoiceRow>>("list_invoices", q);
/** One page of expenses, with the total of everything that matched. */
export const listExpenses = (q: ExpenseQuery) =>
  query<Page<Expense> & { sum: number }>("list_expenses", q);
/** One page of the ledger. The running balance spans the whole filtered set. */
export const listLedger = (q: LedgerQuery) =>
  query<Page<LedgerRow> & { closing: number }>("list_ledger", q);
/** Outstanding per customer, so the customer cards do not need every invoice. */
export async function loadCustomerBalances(): Promise<Record<string, number>> {
  const { data, error } = await supabase!.rpc("customer_balances");
  check(error);
  return (data ?? {}) as Record<string, number>;
}
/** Every headline figure, over the whole workspace regardless of paging. */
export async function loadSummary(): Promise<Summary> {
  const { data, error } = await supabase!.rpc("workspace_summary");
  check(error);
  return data as Summary;
}
async function owner() {
  const { data, error } = await supabase!.auth.getUser();
  check(error);
  if (!data.user) throw new Error("Please sign in again.");
  return data.user.id;
}
export async function saveBusiness(details: Business) {
  const { error } = await supabase!
    .from("business_profiles")
    .upsert({ owner_id: await owner(), details });
  check(error);
}
export async function saveCustomer(customer: Customer) {
  const { error } = await supabase!
    .from("customers")
    .upsert({ ...customer, owner_id: await owner() });
  check(error);
}
/**
 * Removes a customer outright. Only ever called for customers with no invoices:
 * the invoices table carries a foreign key to (id, owner_id) with no ON DELETE
 * clause, so the database refuses to orphan financial history. The caller checks
 * first so the user gets a real explanation instead of a constraint violation.
 */
export async function deleteCustomer(id: string) {
  const { error } = await supabase!
    .from("customers")
    .delete()
    .eq("id", id)
    .eq("owner_id", await owner());
  check(error);
}
export async function createInvoice(input: InvoiceInput) {
  const { error } = await supabase!.rpc("create_invoice", { payload: input });
  check(error);
}
/**
 * One invoice by id, for the moment just after it was written.
 *
 * loadReference deliberately returns no invoices — transactions are paged per
 * view — so a freshly created or corrected invoice cannot be found there, and
 * the page query may not hold it either (it sorts by date, and the caller may be
 * on page four). Reading the single row back is the only way to put the saved
 * document on screen.
 */
export async function getInvoice(id: string): Promise<Invoice | null> {
  const { data, error } = await supabase!
    .from("invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  check(error);
  return (data as Invoice) ?? null;
}
/**
 * Corrects an invoice in place, keeping its number. The server refuses once a
 * payment exists against it, so this is only ever reachable for an invoice that
 * has settled nothing yet.
 */
export async function updateInvoice(input: InvoiceInput) {
  const { error } = await supabase!.rpc("update_invoice", { payload: input });
  check(error);
}
/**
 * Removes an invoice from the record. Reachable only when no payment exists
 * against it — which covers an unpaid invoice and every voided one. The number
 * is not reused, so the gap it leaves is the trace.
 */
export async function deleteInvoice(id: string) {
  const { error } = await supabase!.rpc("delete_invoice", {
    invoice_uuid: id,
  });
  check(error);
}
export async function recordPayment(payment: Payment) {
  const { error } = await supabase!.rpc("record_payment", { payload: payment });
  check(error);
}
/**
 * Records or updates what a customer owed before Opervia. An amount of zero
 * clears it, which the server refuses once payments have been settled against it.
 */
export async function saveOpeningBalance(input: {
  customer_id: string;
  date: string;
  amount: number;
  note: string;
}) {
  const { error } = await supabase!.rpc("save_opening_balance", {
    payload: input,
  });
  check(error);
}
export async function voidInvoice(id: string) {
  const { error } = await supabase!.rpc("void_invoice", { invoice_uuid: id });
  check(error);
}
/**
 * Records a new expense, or updates one already recorded. Unlike invoices and
 * payments, an expense is a note-to-self rather than a document a customer
 * holds, so correcting a typo is allowed — the own_expenses policy is FOR ALL.
 */
export async function saveExpense(expense: Expense) {
  const { error } = await supabase!
    .from("expenses")
    .upsert({ ...expense, owner_id: await owner() });
  check(error);
}
export async function deleteExpense(id: string) {
  const { error } = await supabase!
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("owner_id", await owner());
  check(error);
}
