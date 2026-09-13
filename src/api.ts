import { createClient } from "@supabase/supabase-js";
import { Preferences } from "@capacitor/preferences";
import { isNative } from "./lib/platform";
import type {
  Business,
  Customer,
  Data,
  Expense,
  InvoiceInput,
  Payment,
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
export async function loadData(): Promise<Data> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const [business, customers, invoices, payments, expenses, openings] =
    await Promise.all(
      [
        "business_profiles",
        "customers",
        "invoices",
        "payments",
        "expenses",
        "opening_balances",
      ].map(async (table) => {
        const rows: Record<string, unknown>[] = [];
        for (let offset = 0; offset < 100000;) {
        const { data, error } = await supabase!
          .from(table)
          .select("*")
          .order(
            table === "business_profiles"
              ? "owner_id"
              : table === "opening_balances"
                ? "customer_id"
                : "id",
          )
          .range(offset, offset + 499);
        check(error);
        if (!data?.length) return rows;
        rows.push(...data);
        offset += data.length;
      }
      throw new Error(
        "Workspace record limit reached. Export and archive records before continuing.",
      );
    }),
  );
  return {
    business: {
      ...defaultBusiness,
      ...((business[0]?.details as Partial<Business>) ?? {}),
    },
    customers,
    invoices,
    payments,
    expenses,
    openings,
  } as Data;
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
export async function saveExpense(expense: Expense) {
  const { error } = await supabase!
    .from("expenses")
    .insert({ ...expense, owner_id: await owner() });
  check(error);
}
