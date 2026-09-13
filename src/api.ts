import { createClient } from "@supabase/supabase-js";
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
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      })
    : null;
function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
export async function loadData(): Promise<Data> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const [business, customers, invoices, payments, expenses] = await Promise.all(
    ["business_profiles", "customers", "invoices", "payments", "expenses"].map(
      async (table) => {
        const rows: Record<string, unknown>[] = [];
        for (let offset = 0; offset < 100000;) {
          const { data, error } = await supabase!
            .from(table)
            .select("*")
            .order(table === "business_profiles" ? "owner_id" : "id")
            .range(offset, offset + 499);
          check(error);
          if (!data?.length) return rows;
          rows.push(...data);
          offset += data.length;
        }
        throw new Error(
          "Workspace record limit reached. Export and archive records before continuing.",
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
    invoices,
    payments,
    expenses,
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
export async function createInvoice(input: InvoiceInput) {
  const { error } = await supabase!.rpc("create_invoice", { payload: input });
  check(error);
}
export async function recordPayment(payment: Payment) {
  const { error } = await supabase!.rpc("record_payment", { payload: payment });
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
