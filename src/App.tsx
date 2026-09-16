import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Contrast,
  Copy,
  Download,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import * as api from "./api";
import {
  type Customer,
  type Data,
  type Expense,
  type Invoice,
  type InvoiceInput,
  emptyData,
  today,
  plusDays,
  money,
  dateLabel,
  paid,
  balance,
  status,
  canDeleteCustomer,
  canDeleteInvoice,
  canEditInvoice,
  invoiceCountFor,
  openingFor,
  openingPaid,
  openingOutstanding,
  totalOpeningOutstanding,
  queryInvoices,
  queryExpenses,
  queryLedger,
  summarise,
  type ExpenseQuery,
  type InvoiceQuery,
  type LedgerMode,
  type LedgerQuery,
  type Summary,
  totals,
  validateInvoice,
  ledger,
  toCsv,
  CSV_MIME,
  roundMoney,
} from "./domain";
import { makeDemo } from "./demo";
import Auth from "./Auth";
import InvoicePrint from "./InvoicePrint";
import ModalShell from "./components/ModalShell";
import WriteError from "./components/WriteError";
import ConfirmDialog from "./components/ConfirmDialog";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import BottomNav from "./components/BottomNav";
import Overview from "./pages/Overview";
import Invoices from "./pages/Invoices";
import Ledger from "./pages/Ledger";
import Customers from "./pages/Customers";
import Expenses from "./pages/Expenses";
import CustomerForm from "./forms/CustomerForm";
import BusinessForm from "./forms/BusinessForm";
import InvoiceForm from "./forms/InvoiceForm";
import PaymentForm from "./forms/PaymentForm";
import ExpenseForm from "./forms/ExpenseForm";
import { clearRescuedDraft, hasRescuedDraft } from "./lib/draft";
import { errorText } from "./lib/errors";
import { useDebounced, useQuery } from "./lib/useQuery";
import Pager from "./components/Pager";
import FilterBar from "./components/FilterBar";
import { isNative, printDocument, saveTextFile } from "./lib/platform";
import { readMonoPrint, saveMonoPrint } from "./lib/printStyle";
import {
  applyTheme,
  readTheme,
  watchSystemTheme,
  type Theme,
} from "./lib/theme";
import { initBackButton, initNative, setNativeTheme } from "./lib/native";
import type { Modal, Page } from "./lib/nav";

/** Rows per page. Tuned for a phone: a page you can thumb through, not scroll. */
const PAGE = 25;
const LEDGER_PAGE = 50;

/**
 * Switches the sheet between the brand greens and black-and-white.
 *
 * It sits in the print toolbar rather than in Settings because it is decided by
 * what comes out of the printer, and the preview beside it is the only place
 * that question can be answered. The choice is remembered, so a business with a
 * mono laser sets it once.
 */
function InkToggle({
  mono,
  onChange,
}: {
  mono: boolean;
  onChange: (mono: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="btn secondary toggle"
      // A toggle keeps one name and reports its state; renaming it to the
      // action ("Colour") would make the pressed state read backwards.
      aria-pressed={mono}
      onClick={() => onChange(!mono)}
    >
      <Contrast size={16} />
      Black &amp; white
    </button>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(!!api.supabase);
  const [recovery, setRecovery] = useState(
    new URLSearchParams(location.search).has("recovery"),
  );
  const [demo, setDemo] = useState(false);
  const [data, setData] = useState<Data>(emptyData);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState<Page>("Overview");
  const [modal, setModal] = useState<Modal>(null);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [search, setSearch] = useState("");
  // Typing must not fire a query per keystroke.
  const debouncedSearch = useDebounced(search.trim(), 300);
  const [filter, setFilter] = useState("All");
  const [invoiceCustomer, setInvoiceCustomer] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [invoiceOffset, setInvoiceOffset] = useState(0);
  const [expenseOffset, setExpenseOffset] = useState(0);
  const [ledgerOffset, setLedgerOffset] = useState(0);
  const [ledgerCustomer, setLedgerCustomer] = useState("");
  const [ledgerMode, setLedgerMode] = useState<LedgerMode>("account");
  const [customerEdit, setCustomerEdit] = useState<Customer | undefined>();
  const [expenseEdit, setExpenseEdit] = useState<Expense | undefined>();
  const [paymentOpen, setPaymentOpen] = useState(false);
  // Set when "Add customer" is used from inside the invoice form. The customer
  // dialog then stacks on top instead of replacing the invoice dialog, so the
  // half-typed invoice is never unmounted.
  const [customerOverInvoice, setCustomerOverInvoice] = useState(false);
  const [presetCustomer, setPresetCustomer] = useState("");
  // The carbon copy: a previous invoice used as the starting point for a new one.
  const [template, setTemplate] = useState<InvoiceInput | null>(null);
  // The pending destructive action, if any. One state for every such action so
  // they all get the same dialog and the same language.
  const [confirming, setConfirming] = useState<
    | { kind: "void"; invoice: Invoice }
    | { kind: "deleteInvoice"; invoice: Invoice }
    | { kind: "customer"; customer: Customer }
    | { kind: "expense"; expense: Expense }
    | null
  >(null);
  // The open invoice, reopened for correction. Only ever set for one that has
  // had nothing paid against it.
  const [editing, setEditing] = useState(false);
  // Ink: the invoice prints in the brand greens, or in black and grey only.
  const [mono, setMono] = useState(readMonoPrint);
  // Settings holds edits in its own form state until Save is pressed. Leaving
  // the page would discard them silently, which is how an uploaded logo gets
  // lost between choosing the file and saving.
  const [settingsDirty, setSettingsDirty] = useState(false);
  /** Where the user tried to go while Settings had unsaved edits. */
  const [pendingPage, setPendingPage] = useState<Page | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  // Bumped after every write; the list views watch it and reload their page.
  const [dataVersion, setDataVersion] = useState(0);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [sessionEnded, setSessionEnded] = useState(false);
  const deliberateSignOut = useRef(false);
  const loadGeneration = useRef(0);
  useEffect(() => {
    if (!api.supabase) return;
    api.supabase.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message);
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = api.supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setAuthLoading(false);
        if (event === "PASSWORD_RECOVERY") setRecovery(true);
        if (event === "SIGNED_OUT") {
          loadGeneration.current++;
          setData(emptyData());
          setSelected(null);
          setModal(null);
          setCustomerOverInvoice(false);
          // An expiry mid-invoice is not a sign-out the user asked for. The
          // draft saved by InvoiceForm survives so it can be offered back.
          setSessionEnded(!deliberateSignOut.current && hasRescuedDraft());
          deliberateSignOut.current = false;
        }
      },
    );
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (session && !demo && !recovery) void refresh();
  }, [session?.user.id, demo, recovery]);
  // Signed back in after an expiry that interrupted an invoice: reopen it.
  useEffect(() => {
    if (!session || !sessionEnded) return;
    setSessionEnded(false);
    if (hasRescuedDraft()) {
      setSelected(null);
      setModal("invoice");
    }
  }, [session?.user.id, sessionEnded]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  // The floating action only earns its place once the heading's "New invoice"
  // has scrolled away. While the page is short it stays hidden, so it can never
  // sit on top of a row the user is trying to tap.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 150);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setScrolled(window.scrollY > 150), [page]);
  // A filter change always returns to page one: staying on page 4 of a narrower
  // result set shows an empty table and reads as "no records".
  useEffect(() => {
    setInvoiceOffset(0);
    setExpenseOffset(0);
    setLedgerOffset(0);
  }, [
    debouncedSearch,
    filter,
    invoiceCustomer,
    expenseCategory,
    from,
    to,
    ledgerCustomer,
    ledgerMode,
  ]);
  // Theme: apply on change, and follow the device while set to "system".
  useEffect(() => {
    const resolved = applyTheme(theme, true);
    if (isNative()) void setNativeTheme(resolved);
  }, [theme]);
  useEffect(
    () =>
      watchSystemTheme(() => {
        if (theme === "system") {
          const resolved = applyTheme("system");
          if (isNative()) void setNativeTheme(resolved);
        }
      }),
    [theme],
  );
  // Native shell wiring. Both are no-ops in the browser.
  useEffect(() => initNative(() => setRecovery(true)), []);
  // Android's back button reads through the same hierarchy the user sees:
  // stacked dialog, then dialog, then back to Overview, then leave the app.
  const backRef = useRef<() => boolean>(() => false);
  backRef.current = () => {
    if (busy) return true;
    if (pendingPage) {
      setPendingPage(null);
      return true;
    }
    if (confirming) {
      setConfirming(null);
      setError("");
      return true;
    }
    if (customerOverInvoice) {
      closeStackedCustomer();
      return true;
    }
    // Back out of a correction to the invoice it belongs to, not out of the
    // dialog: the edits are still on screen and still unsaved.
    if (editing) {
      setEditing(false);
      setError("");
      return true;
    }
    if (modal) {
      closeModal();
      return true;
    }
    if (page !== "Overview") {
      go("Overview");
      return true;
    }
    return false;
  };
  useEffect(() => initBackButton(() => backRef.current()), []);
  async function refresh() {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError("");
    try {
      // Reference data and the headline figures. Transactions are queried per
      // view, so opening a workspace with years of history costs the same as an
      // empty one.
      const [next, totals] = await Promise.all([
        api.loadReference(),
        api.loadSummary(),
      ]);
      if (generation !== loadGeneration.current) return;
      setData(next);
      setSummary(totals);
    } catch (e) {
      if (generation === loadGeneration.current) setError(errorText(e));
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }
  // Re-runs the last failed write. Every write carries a client-generated id and
  // the database functions are idempotent, so a retry cannot duplicate a record.
  const lastWrite = useRef<{ work: () => Promise<void>; success: string }>(
    null,
  );
  const [canRetry, setCanRetry] = useState(false);
  async function act(work: () => Promise<void>, success: string) {
    if (busy) return;
    lastWrite.current = { work, success };
    setBusy(true);
    setError("");
    setCanRetry(false);
    try {
      await work();
      setNotice(success);
      // Every successful write invalidates the list views. Doing it here rather
      // than in sync() covers demo mode too, which writes to state directly.
      setDataVersion((v) => v + 1);
      return true;
    } catch (e) {
      setError(errorText(e));
      setCanRetry(true);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function retryWrite() {
    const last = lastWrite.current;
    if (!last || busy) return;
    await act(last.work, last.success);
  }
  /**
   * Called after every write. It refreshes reference data and the headline
   * figures, then bumps a token the list views watch, so each reloads only its
   * own page instead of the whole workspace being fetched again.
   */
  async function sync() {
    if (demo) return data;
    const [next, figuresNext] = await Promise.all([
      api.loadReference(),
      api.loadSummary(),
    ]);
    setData(next);
    setSummary(figuresNext);
    return next;
  }
  async function voidInvoice(invoice: Invoice) {
    const ok = await act(async () => {
      if (demo)
        setData((d) => ({
          ...d,
          invoices: d.invoices.map((i) =>
            i.id === invoice.id ? { ...i, voided: true } : i,
          ),
        }));
      else {
        await api.voidInvoice(invoice.id);
        await sync();
      }
    }, "Invoice voided");
    if (ok) setConfirming(null);
  }
  async function removeCustomer(customer: Customer) {
    const ok = await act(async () => {
      if (demo) {
        // Demo holds every record in memory, so it can check for itself.
        if (
          !canDeleteCustomer(
            customer.id,
            data,
            invoiceCountFor(customer.id, data.invoices),
          )
        )
          throw new Error(
            "This customer now has invoices, so their details stay on record.",
          );
        setData((d) => ({
          ...d,
          customers: d.customers.filter((c) => c.id !== customer.id),
        }));
      } else {
        // public.delete_customer re-checks against the records themselves and
        // raises the reason, which is the only check that can be trusted: the
        // list may have changed since the dialog opened, and the browser has no
        // invoices to count in the first place.
        await api.deleteCustomer(customer.id);
        await sync();
      }
    }, "Customer deleted");
    if (ok) {
      setConfirming(null);
      closeModal();
    }
  }
  /** Exports a CSV and confirms it: a silent download looks like nothing happened. */
  async function exportCsv(filename: string, rows: unknown[][]) {
    try {
      await saveTextFile(filename, toCsv(rows), CSV_MIME);
      setNotice(isNative() ? "CSV ready to share" : "Exported " + filename);
    } catch (e) {
      setError(errorText(e));
    }
  }
  /**
   * Every row the current filters match, gathered a page at a time.
   *
   * An export built from the rows on screen is a file that looks complete and
   * is not — the same trap the server-side totals exist to avoid. The server
   * caps a page at 500, so a long book is fetched in several passes.
   */
  async function allMatching<T>(
    fetchPage: (
      limit: number,
      offset: number,
      // Structural, not domain.Page: "Page" here is this file's nav-page union.
    ) => Promise<{ rows: T[]; total: number }>,
  ): Promise<T[]> {
    const size = 500;
    const rows: T[] = [];
    for (let offset = 0; ; offset += size) {
      const page = await fetchPage(size, offset);
      rows.push(...page.rows);
      if (!page.rows.length || rows.length >= page.total) return rows;
    }
  }
  async function removeExpense(expense: Expense) {
    const ok = await act(async () => {
      if (demo)
        setData((d) => ({
          ...d,
          expenses: d.expenses.filter((e) => e.id !== expense.id),
        }));
      else {
        await api.deleteExpense(expense.id);
        await sync();
      }
    }, "Expense deleted");
    if (ok) {
      setConfirming(null);
      closeModal();
    }
  }
  // Printing is the deliverable, so a platform that cannot print must say so
  // rather than let the button appear to do nothing — and one that can must
  // confirm the file exists, because a PDF saved silently looks like a PDF that
  // was never saved. Only Android can prove it; a browser tells its page nothing
  // about what its print dialog did, so on web this stays quiet rather than
  // claiming a save it cannot see.
  async function print(documentName: string) {
    try {
      const outcome = await printDocument(documentName);
      if (outcome === "unsupported")
        setError(
          "Printing is not available on this device yet. Open Opervia in a browser to print or save a PDF.",
        );
      else if (outcome === "completed")
        setNotice(`${documentName} saved successfully`);
      else if (outcome === "failed")
        setError(
          "That print job did not finish. Please try again, or pick a different destination.",
        );
      // "cancelled" is the user changing their mind, and "unknown" is a
      // platform that will not say. Neither is news.
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function updateInvoice(input: InvoiceInput) {
    return await act(async () => {
      validateInvoice(input);
      if (demo) {
        const existing = data.invoices.find((i) => i.id === input.id)!;
        const customer = data.customers.find(
          (c) => c.id === input.customer_id,
        )!;
        // The number, the id and the void flag are the invoice's identity and
        // survive the correction; everything else is re-issued from the form.
        const updated: Invoice = {
          ...existing,
          customer_id: input.customer_id,
          customer: { ...customer },
          business: { ...data.business },
          date: input.date,
          due_date: input.due_date,
          items: input.items.map((item) => ({ ...item })),
          notes: input.notes,
          tax_rate: input.tax_rate,
          ...totals(input.items, input.tax_rate),
        };
        setData((d) => ({
          ...d,
          invoices: d.invoices.map((i) => (i.id === input.id ? updated : i)),
          payments: input.deposit
            ? [
                ...d.payments,
                {
                  id: crypto.randomUUID(),
                  invoice_id: input.id,
                  date: input.date,
                  amount: input.deposit,
                  method: input.method,
                  reference: "Initial deposit",
                },
              ]
            : d.payments,
        }));
        setSelected(updated);
      } else {
        await api.updateInvoice(input);
        await sync();
        setSelected(await api.getInvoice(input.id));
      }
    }, "Invoice updated");
  }
  async function removeInvoice(invoice: Invoice) {
    const ok = await act(async () => {
      if (demo)
        setData((d) => ({
          ...d,
          invoices: d.invoices.filter((i) => i.id !== invoice.id),
          payments: d.payments.filter((p) => p.invoice_id !== invoice.id),
        }));
      else {
        await api.deleteInvoice(invoice.id);
        await sync();
      }
    }, "Invoice deleted");
    if (ok) {
      setConfirming(null);
      closeModal();
    }
  }
  function changeMono(next: boolean) {
    setMono(next);
    saveMonoPrint(next);
  }
  function go(p: Page) {
    if (settingsDirty && page === "Settings" && p !== "Settings") {
      setPendingPage(p);
      return;
    }
    if (page === "Settings" && p !== "Settings") setSettingsDirty(false);
    setPage(p);
    setSearch("");
    setFilter("All");
    setInvoiceCustomer("");
    setExpenseCategory("All");
    setFrom("");
    setTo("");
    setInvoiceOffset(0);
    setExpenseOffset(0);
    setLedgerOffset(0);
    window.scrollTo({ top: 0 });
  }
  function clearFilters() {
    setSearch("");
    setFilter("All");
    setInvoiceCustomer("");
    setExpenseCategory("All");
    setFrom("");
    setTo("");
  }
  function openNew() {
    setTemplate(null);
    setSelected(null);
    setModal("invoice");
    setError("");
  }
  // Last week's sheet under this week's blank one: everything but the dates,
  // the deposit and the identity carries over.
  function invoiceAgain(source: Invoice) {
    clearRescuedDraft();
    setTemplate({
      id: crypto.randomUUID(),
      customer_id: source.customer_id,
      date: today(),
      due_date: plusDays(today(), 30),
      items: source.items.map((i) => ({ ...i })),
      notes: source.notes,
      tax_rate: source.tax_rate,
      deposit: 0,
      method: "Cash",
    });
    setSelected(null);
    setModal("invoice");
    setError("");
  }
  function closeModal() {
    if (busy) return;
    setModal(null);
    setSelected(null);
    setEditing(false);
    setCustomerEdit(undefined);
    setExpenseEdit(undefined);
    setPaymentOpen(false);
    setCustomerOverInvoice(false);
    setError("");
  }
  // Closes only the stacked customer dialog, leaving the invoice underneath intact.
  function closeStackedCustomer() {
    if (busy) return;
    setCustomerOverInvoice(false);
    setCustomerEdit(undefined);
    setError("");
  }
  async function logout() {
    clearRescuedDraft();
    if (demo) {
      setDemo(false);
      setData(emptyData());
      go("Overview");
      return;
    }
    deliberateSignOut.current = true;
    await act(async () => {
      const r = await api.supabase!.auth.signOut();
      if (r.error) throw r.error;
      setData(emptyData());
      go("Overview");
    }, "Signed out");
  }
  // Headline figures come from the server so they cover the whole workspace,
  // never just the page on screen. Demo computes the same shape in memory.
  const figures = demo ? summarise(data) : summary;
  const outstanding = roundMoney(
    (figures?.invoiceOutstanding ?? 0) + (figures?.openingOutstanding ?? 0),
  );
  const openingOwed = figures?.openingOutstanding ?? 0;
  const received = figures?.received ?? 0;
  const expenses = figures?.expenses ?? 0;

  // How many invoices the open customer has. Asked of the server, because
  // loadReference carries none: counting data.invoices in the browser returns
  // zero for everyone, which is what used to offer Delete on a customer with a
  // shelf of invoices. Null while it is still being fetched.
  const customerInvoices = useQuery(
    () =>
      demo
        ? Promise.resolve(invoiceCountFor(customerEdit!.id, data.invoices))
        : api.countCustomerInvoices(customerEdit!.id),
    JSON.stringify(["customer-invoices", customerEdit?.id, demo, dataVersion]),
    !!customerEdit,
  );
  const customerInvoiceCount = customerEdit ? customerInvoices.data : 0;
  // Invoices: one page, filtered and counted on the server.
  const invoiceQuery: InvoiceQuery = {
    status: filter,
    customer_id: invoiceCustomer || undefined,
    from: from || undefined,
    to: to || undefined,
    search: debouncedSearch || undefined,
    limit: PAGE,
    offset: invoiceOffset,
  };
  const invoicePage = useQuery(
    () =>
      demo
        ? Promise.resolve(queryInvoices(data, invoiceQuery))
        : api.listInvoices(invoiceQuery),
    JSON.stringify([invoiceQuery, demo, dataVersion, page === "Invoices"]),
    page === "Invoices" || page === "Overview",
  );
  // Overview shows the five most recent, unfiltered.
  const recentQuery: InvoiceQuery = { limit: 5, offset: 0 };
  const recentPage = useQuery(
    () =>
      demo
        ? Promise.resolve(queryInvoices(data, recentQuery))
        : api.listInvoices(recentQuery),
    JSON.stringify(["recent", demo, dataVersion]),
    page === "Overview",
  );
  const expenseQuery: ExpenseQuery = {
    category: expenseCategory,
    from: from || undefined,
    to: to || undefined,
    search: debouncedSearch || undefined,
    limit: PAGE,
    offset: expenseOffset,
  };
  const expensePage = useQuery(
    () =>
      demo
        ? Promise.resolve(queryExpenses(data, expenseQuery))
        : api.listExpenses(expenseQuery),
    JSON.stringify([expenseQuery, demo, dataVersion]),
    page === "Expenses",
  );
  const ledgerQuery: LedgerQuery = {
    // The cash book covers the whole business; see LedgerMode.
    customer_id: (ledgerMode === "account" && ledgerCustomer) || undefined,
    from: from || undefined,
    to: to || undefined,
    search: debouncedSearch || undefined,
    limit: LEDGER_PAGE,
    offset: ledgerOffset,
    mode: ledgerMode,
  };
  const ledgerPage = useQuery(
    () =>
      demo
        ? Promise.resolve(queryLedger(data, ledgerQuery))
        : api.listLedger(ledgerQuery),
    JSON.stringify([ledgerQuery, demo, dataVersion]),
    page === "Ledger",
  );
  const balanceQuery = useQuery(
    () =>
      demo
        ? Promise.resolve(
            Object.fromEntries(
              data.customers.map((c) => [
                c.id,
                roundMoney(
                  data.invoices
                    .filter((i) => !i.voided && i.customer_id === c.id)
                    .reduce((s, i) => s + balance(i, data.payments), 0) +
                    openingOutstanding(c.id, data),
                ),
              ]),
            ),
          )
        : api.loadCustomerBalances(),
    JSON.stringify(["balances", demo, dataVersion]),
    page === "Customers",
  );
  const customerBalances = balanceQuery.data ?? {};
  const currentInvoice = selected
    ? ((invoicePage.data?.rows.find((i) => i.id === selected.id) ??
        selected) as Invoice)
    : undefined;
  const openInvoice = (i: Invoice) => {
    setSelected(i);
    setModal("invoice");
  };
  if (authLoading)
    return (
      <div className="loading-screen">
        <img
          src="/favicon.svg?v=2"
          width="52"
          height="52"
          alt=""
          aria-hidden="true"
        />
        <p>Opening Opervia…</p>
      </div>
    );
  if ((!session && !demo) || recovery)
    return (
      <Auth
        onDemo={() => {
          setDemo(true);
          setData(makeDemo());
          setError("");
        }}
        recovery={recovery}
        sessionEnded={sessionEnded}
        onRecovered={() => setRecovery(false)}
      />
    );
  return (
    <div className="app-shell">
      <Sidebar data={data} page={page} demo={demo} go={go} logout={logout} />
      <div className="app-main">
        <Topbar
          page={page}
          demo={demo}
          email={session?.user.email}
          theme={theme}
          onTheme={setTheme}
          go={go}
          logout={logout}
        />
        {demo && (
          <div className="demo-banner">
            You’re exploring sample data. Changes last until you leave this
            demo.
            <button onClick={logout}>
              Exit demo <ArrowRight size={13} />
            </button>
          </div>
        )}
        <main className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {page === "Overview"
                  ? "YOUR BUSINESS AT A GLANCE"
                  : "YOUR EVERYDAY BOOKS"}
              </span>
              <h1>
                {page === "Overview"
                  ? "A clearer picture."
                  : page === "Ledger"
                    ? ledgerMode === "cash"
                      ? "Where your money went."
                      : "Your customer ledger."
                    : page === "Settings"
                      ? "Make yourself at home."
                      : `${page}.`}
              </h1>
              <p>
                {
                  {
                    Overview:
                      "A little less paperwork. A little more peace of mind.",
                    Invoices: "Create, collect, and keep everything in order.",
                    Ledger:
                      ledgerMode === "cash"
                        ? "Every payment in and every expense out, in one line."
                        : "Every invoice and payment, with a running balance.",
                    Customers:
                      "Good relationships start with the little details.",
                    Expenses: "Keep track of the cost of doing business.",
                    Settings: "Your business details, ready for every invoice.",
                  }[page]
                }
              </p>
            </div>
            <div className="heading-actions">
              {page === "Overview" || page === "Invoices" ? (
                <>
                  <button
                    className="btn secondary"
                    onClick={() => setModal("blank")}
                  >
                    <Printer size={16} />
                    Blank invoice
                  </button>
                  <button className="btn primary" onClick={openNew}>
                    <Plus size={18} />
                    New invoice
                  </button>
                </>
              ) : page === "Customers" ? (
                <button
                  className="btn primary"
                  onClick={() => setModal("customer")}
                >
                  <Plus size={18} />
                  Add customer
                </button>
              ) : page === "Expenses" ? (
                <button
                  className="btn primary"
                  onClick={() => setModal("expense")}
                >
                  <Plus size={18} />
                  Add expense
                </button>
              ) : page === "Ledger" ? (
                <button
                  className="btn secondary"
                  onClick={() =>
                    void (async () => {
                      const rows = await allMatching((limit, offset) => {
                        const q = { ...ledgerQuery, limit, offset };
                        return demo
                          ? Promise.resolve(queryLedger(data, q))
                          : api.listLedger(q);
                      });
                      await exportCsv(
                        ledgerMode === "cash"
                          ? "opervia-cash-book.csv"
                          : "opervia-ledger.csv",
                        [
                          [
                            "Date",
                            "Reference",
                            "Details",
                            "Type",
                            "Debit MUR",
                            "Credit MUR",
                            ledgerMode === "cash"
                              ? "Net cash MUR"
                              : "Balance MUR",
                          ],
                          ...rows.map((r) => [
                            r.date,
                            r.label,
                            r.detail,
                            r.type,
                            r.debit,
                            r.credit,
                            r.balance,
                          ]),
                        ],
                      );
                    })()
                  }
                >
                  <Download size={16} />
                  Export CSV
                </button>
              ) : null}
            </div>
          </div>
          {error && (
            <div className="error page-error" role="alert">
              {error}
              {!demo && (
                <button className="text-button" onClick={refresh}>
                  Retry loading
                </button>
              )}
            </div>
          )}
          {notice && (
            <div className="toast" role="status">
              <Check size={17} />
              {notice}
            </div>
          )}
          {loading ? (
            <div className="empty">
              <RefreshCw className="spin" />
              <p>Loading your workspace…</p>
            </div>
          ) : (
            <>
              {page === "Overview" && (
                <Overview
                  demo={demo}
                  totals={figures}
                  recent={recentPage.data?.rows ?? []}
                  loading={recentPage.loading}
                  outstanding={outstanding}
                  openingOwed={openingOwed}
                  received={received}
                  expenses={expenses}
                  go={go}
                  openNew={openNew}
                  onOpenInvoice={openInvoice}
                  onAddCustomer={() => setModal("customer")}
                  onAddExpense={() => setModal("expense")}
                  onReviewOverdue={() => {
                    go("Invoices");
                    setFilter("Overdue");
                  }}
                />
              )}
              {page === "Invoices" && (
                <Invoices
                  page={invoicePage.data}
                  loading={invoicePage.loading}
                  customers={data.customers}
                  filter={filter}
                  setFilter={setFilter}
                  customerId={invoiceCustomer}
                  setCustomerId={setInvoiceCustomer}
                  search={search}
                  setSearch={setSearch}
                  from={from}
                  to={to}
                  setRange={(f, t) => {
                    setFrom(f);
                    setTo(t);
                  }}
                  onClearFilters={clearFilters}
                  limit={PAGE}
                  offset={invoiceOffset}
                  setOffset={setInvoiceOffset}
                  onOpen={openInvoice}
                  onNew={openNew}
                />
              )}
              {page === "Ledger" && (
                <Ledger
                  page={ledgerPage.data}
                  loading={ledgerPage.loading}
                  limit={LEDGER_PAGE}
                  offset={ledgerOffset}
                  setOffset={setLedgerOffset}
                  from={from}
                  to={to}
                  setRange={(f, t) => {
                    setFrom(f);
                    setTo(t);
                  }}
                  search={search}
                  setSearch={setSearch}
                  customers={data.customers}
                  ledgerCustomer={ledgerCustomer}
                  setLedgerCustomer={setLedgerCustomer}
                  mode={ledgerMode}
                  setMode={setLedgerMode}
                  opening={
                    ledgerMode === "account" && ledgerCustomer
                      ? openingFor(ledgerCustomer, data)
                      : undefined
                  }
                  openingOwed={
                    ledgerMode === "account" && ledgerCustomer
                      ? openingOutstanding(ledgerCustomer, data)
                      : 0
                  }
                  busy={busy}
                  onRecordOpeningPayment={async (payment) => {
                    return !!(await act(async () => {
                      if (demo)
                        setData((d) => ({
                          ...d,
                          payments: [...d.payments, payment],
                        }));
                      else {
                        await api.recordPayment(payment);
                        await sync();
                      }
                    }, "Payment recorded"));
                  }}
                />
              )}
              {page === "Customers" && (
                <Customers
                  customers={data.customers}
                  balances={customerBalances}
                  openings={Object.fromEntries(
                    data.openings.map((o) => [
                      o.customer_id,
                      openingOutstanding(o.customer_id, data),
                    ]),
                  )}
                  search={search}
                  setSearch={setSearch}
                  onOpen={(c) => {
                    setCustomerEdit(c);
                    setModal("customer");
                  }}
                />
              )}
              {page === "Expenses" && (
                <Expenses
                  page={expensePage.data}
                  loading={expensePage.loading}
                  allTotal={expenses}
                  category={expenseCategory}
                  setCategory={setExpenseCategory}
                  search={search}
                  setSearch={setSearch}
                  from={from}
                  to={to}
                  setRange={(f, t) => {
                    setFrom(f);
                    setTo(t);
                  }}
                  onClearFilters={clearFilters}
                  limit={PAGE}
                  offset={expenseOffset}
                  setOffset={setExpenseOffset}
                  onOpen={(e) => {
                    setExpenseEdit(e);
                    setModal("expense");
                    setError("");
                  }}
                  onExport={() =>
                    void (async () => {
                      const rows = await allMatching((limit, offset) => {
                        const q = { ...expenseQuery, limit, offset };
                        return demo
                          ? Promise.resolve(queryExpenses(data, q))
                          : api.listExpenses(q);
                      });
                      await exportCsv("opervia-expenses.csv", [
                        [
                          "Date",
                          "Description",
                          "Details",
                          "Category",
                          "Amount MUR",
                        ],
                        ...rows.map((e) => [
                          e.date,
                          e.description,
                          e.note ?? "",
                          e.category,
                          e.amount,
                        ]),
                      ]);
                    })()
                  }
                />
              )}
              {page === "Settings" && (
                <BusinessForm
                  onDirtyChange={setSettingsDirty}
                  theme={theme}
                  onTheme={setTheme}
                  business={data.business}
                  busy={busy}
                  demo={demo}
                  email={session?.user.email}
                  onSave={async (business) => {
                    await act(async () => {
                      if (demo) setData((d) => ({ ...d, business }));
                      else {
                        await api.saveBusiness(business);
                        await sync();
                      }
                    }, "Business details saved");
                  }}
                />
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <img
            className="footer-mark"
            src="/favicon.svg?v=2"
            width="22"
            height="22"
            alt=""
            aria-hidden="true"
          />
          <span>opervia</span> Your business, in balance.
        </footer>
      </div>
      {/* Mobile navigation. Five daily destinations in the thumb zone, one tap
          each; Settings and sign-out live in the topbar. Hidden above 760px,
          where the sidebar is the navigation. */}
      <BottomNav
        page={page}
        unpaidCount={data.invoices.filter((i) => !i.voided).length}
        go={go}
      />
      <button
        type="button"
        className={`fab ${scrolled ? "fab-in" : ""}`}
        onClick={openNew}
        aria-label="Create an invoice"
        aria-hidden={!scrolled}
        tabIndex={scrolled ? 0 : -1}
      >
        <Plus size={26} strokeWidth={2.2} />
      </button>
      {(modal === "customer" || customerOverInvoice) && (
        <ModalShell
          title={customerEdit ? "Customer details" : "A new connection"}
          suspended={!!confirming}
          onClose={customerOverInvoice ? closeStackedCustomer : closeModal}
        >
          <CustomerForm
            customer={customerEdit}
            busy={busy}
            invoiceCount={customerInvoiceCount ?? 0}
            onDelete={
              // Never offered before the count is in: an affordance that fails
              // on tapping is worse than one that appears a moment late.
              customerEdit &&
              customerInvoiceCount !== null &&
              canDeleteCustomer(customerEdit.id, data, customerInvoiceCount)
                ? () =>
                    setConfirming({ kind: "customer", customer: customerEdit })
                : undefined
            }
            opening={
              customerEdit ? openingFor(customerEdit.id, data) : undefined
            }
            openingSettled={
              customerEdit ? openingPaid(customerEdit.id, data.payments) : 0
            }
            onSave={async (customer, owed) => {
              const ok = await act(async () => {
                if (demo) {
                  setData((d) => ({
                    ...d,
                    customers: [
                      ...d.customers.filter((c) => c.id !== customer.id),
                      customer,
                    ],
                    openings: [
                      ...d.openings.filter(
                        (o) => o.customer_id !== customer.id,
                      ),
                      ...(owed.amount > 0
                        ? [{ ...owed, customer_id: customer.id }]
                        : []),
                    ],
                  }));
                } else {
                  // The customer must exist before an opening balance can
                  // reference it, so these run in order, not in parallel.
                  await api.saveCustomer(customer);
                  const existing = openingFor(customer.id, data);
                  if (owed.amount > 0 || existing)
                    await api.saveOpeningBalance({
                      customer_id: customer.id,
                      ...owed,
                    });
                  await sync();
                }
              }, "Customer saved");
              if (!ok) return;
              if (customerOverInvoice) {
                // Hand the new customer straight back to the waiting invoice.
                setPresetCustomer(customer.id);
                closeStackedCustomer();
              } else closeModal();
            }}
          />
          {error && (
            <WriteError
              error={error}
              canRetry={canRetry}
              busy={busy}
              onRetry={retryWrite}
              safe="Trying again will not create a second customer."
            />
          )}
        </ModalShell>
      )}
      {modal === "expense" && (
        <ModalShell
          title={expenseEdit ? "Edit this expense" : "Record an expense"}
          suspended={!!confirming}
          onClose={closeModal}
        >
          <ExpenseForm
            expense={expenseEdit}
            busy={busy}
            onDelete={
              expenseEdit
                ? () => setConfirming({ kind: "expense", expense: expenseEdit })
                : undefined
            }
            onSave={async (expense) => {
              const ok = await act(
                async () => {
                  if (demo)
                    setData((d) => ({
                      ...d,
                      expenses: [
                        ...d.expenses.filter((x) => x.id !== expense.id),
                        expense,
                      ],
                    }));
                  else {
                    await api.saveExpense(expense);
                    await sync();
                  }
                },
                expenseEdit ? "Expense updated" : "Expense recorded",
              );
              if (ok) closeModal();
            }}
          />
          {error && (
            <WriteError
              error={error}
              canRetry={canRetry}
              busy={busy}
              onRetry={retryWrite}
              safe="Trying again will not record the expense twice."
            />
          )}
        </ModalShell>
      )}
      {modal === "blank" && (
        <ModalShell title="Blank invoice sheet" wide onClose={closeModal}>
          <div className="print-toolbar">
            <p>
              Print an empty sheet to fill in by hand. No ledger entry is
              created.
            </p>
            <div className="button-row">
              <InkToggle mono={mono} onChange={changeMono} />
              <button
                type="button"
                className="btn primary"
                onClick={() => void print("Blank invoice sheet")}
              >
                <Printer size={17} />
                Print / Save PDF
              </button>
            </div>
          </div>
          <div className="print-area">
            <InvoicePrint
              business={data.business}
              payments={[]}
              blank
              mono={mono}
            />
          </div>
        </ModalShell>
      )}
      {modal === "invoice" && (
        <ModalShell
          title={
            selected
              ? editing
                ? `Correct ${selected.number}`
                : `${selected.number} · ${selected.customer.name}`
              : "Create an invoice"
          }
          wide
          suspended={customerOverInvoice || !!confirming}
          onClose={closeModal}
        >
          {currentInvoice && !editing ? (
            <>
              <div className="print-toolbar">
                <span
                  className={`badge ${status(currentInvoice, data.payments).toLowerCase()}`}
                >
                  {status(currentInvoice, data.payments)}
                </span>
                <div className="button-row">
                  {!currentInvoice.voided &&
                    balance(currentInvoice, data.payments) > 0 && (
                      <button
                        type="button"
                        className="btn primary"
                        aria-expanded={paymentOpen}
                        aria-controls="payment-form"
                        onClick={() => setPaymentOpen((v) => !v)}
                      >
                        <Plus size={16} />
                        {paymentOpen ? "Close payment" : "Record payment"}
                      </button>
                    )}
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => void print(currentInvoice.number)}
                  >
                    <Printer size={16} />
                    Print / Save PDF
                  </button>
                  <InkToggle mono={mono} onChange={changeMono} />
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => invoiceAgain(currentInvoice)}
                  >
                    <Copy size={16} />
                    Invoice again
                  </button>
                  {canEditInvoice(currentInvoice, data.payments) && (
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={busy}
                      onClick={() => {
                        setError("");
                        setPaymentOpen(false);
                        setEditing(true);
                      }}
                    >
                      <Pencil size={16} />
                      Edit
                    </button>
                  )}
                  {!currentInvoice.voided &&
                    paid(currentInvoice, data.payments) === 0 && (
                      <button
                        className="btn danger"
                        disabled={busy}
                        onClick={() =>
                          setConfirming({
                            kind: "void",
                            invoice: currentInvoice,
                          })
                        }
                      >
                        Void
                      </button>
                    )}
                  {canDeleteInvoice(currentInvoice, data.payments) && (
                    <button
                      className="btn danger"
                      disabled={busy}
                      onClick={() =>
                        setConfirming({
                          kind: "deleteInvoice",
                          invoice: currentInvoice,
                        })
                      }
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  )}
                </div>
              </div>
              {paymentOpen && (
                <PaymentForm
                  invoice={currentInvoice}
                  payments={data.payments}
                  busy={busy}
                  onSave={async (payment) => {
                    const ok = await act(async () => {
                      if (
                        payment.amount <= 0 ||
                        payment.amount > balance(currentInvoice, data.payments)
                      )
                        throw new Error(
                          "Payment must be positive and no greater than the balance.",
                        );
                      if (demo)
                        setData((d) => ({
                          ...d,
                          payments: [...d.payments, payment],
                        }));
                      else {
                        await api.recordPayment(payment);
                        await sync();
                      }
                    }, "Payment recorded");
                    if (ok) setPaymentOpen(false);
                  }}
                />
              )}
              {error && (
                <WriteError
                  error={error}
                  canRetry={canRetry}
                  busy={busy}
                  onRetry={retryWrite}
                  safe="Trying again will not record the payment twice."
                />
              )}
              <div className="print-area">
                <InvoicePrint
                  invoice={currentInvoice}
                  business={data.business}
                  payments={data.payments}
                  mono={mono}
                />
              </div>
              {data.payments.some(
                (p) => p.invoice_id === currentInvoice.id,
              ) && (
                <div className="payment-history">
                  <h3>Payment history</h3>
                  {data.payments
                    .filter((p) => p.invoice_id === currentInvoice.id)
                    .map((p) => (
                      <div key={p.id}>
                        <span>
                          {dateLabel(p.date)} · {p.method}
                          {p.reference ? ` · ${p.reference}` : ""}
                        </span>
                        <b>{money(p.amount)}</b>
                      </div>
                    ))}
                </div>
              )}
            </>
          ) : (
            <>
              <InvoiceForm
                // Remounting on the way in and out of a correction is the point:
                // the form seeds its state once, so a shared instance would show
                // the new-invoice draft when editing, and the edited invoice
                // afterwards.
                key={editing ? `edit-${currentInvoice?.id}` : "new"}
                data={data}
                busy={busy}
                template={template}
                invoice={editing ? currentInvoice : undefined}
                onCancel={() => {
                  setEditing(false);
                  setError("");
                }}
                presetCustomer={presetCustomer}
                onPresetConsumed={() => setPresetCustomer("")}
                onAddCustomer={() => {
                  setCustomerEdit(undefined);
                  setError("");
                  setCustomerOverInvoice(true);
                }}
                onSave={async (input) => {
                  if (editing) {
                    const saved = await updateInvoice(input);
                    if (saved) setEditing(false);
                    return !!saved;
                  }
                  const ok = await act(async () => {
                    validateInvoice(input);
                    if (demo) {
                      const customer = data.customers.find(
                        (c) => c.id === input.customer_id,
                      )!;
                      const invoice: Invoice = {
                        ...input,
                        ...totals(input.items, input.tax_rate),
                        customer: { ...customer },
                        business: { ...data.business },
                        number: `OP-${1001 + data.invoices.length}`,
                        voided: false,
                      };
                      setData((d) => ({
                        ...d,
                        invoices: [...d.invoices, invoice],
                        payments: input.deposit
                          ? [
                              ...d.payments,
                              {
                                id: crypto.randomUUID(),
                                invoice_id: invoice.id,
                                date: invoice.date,
                                amount: input.deposit,
                                method: input.method,
                                reference: "Initial deposit",
                              },
                            ]
                          : d.payments,
                      }));
                      setSelected(invoice);
                    } else {
                      await api.createInvoice(input);
                      await sync();
                      // Read the invoice back rather than looking for it in the
                      // reference data, which carries no transactions at all.
                      setSelected(await api.getInvoice(input.id));
                    }
                  }, "Invoice created");
                  return !!ok;
                }}
              />
              {error && !customerOverInvoice && (
                <WriteError
                  error={error}
                  canRetry={canRetry}
                  busy={busy}
                  onRetry={retryWrite}
                  safe="Trying again is safe — this invoice cannot be created twice."
                />
              )}
            </>
          )}
        </ModalShell>
      )}
      {confirming?.kind === "void" && (
        <ConfirmDialog
          title={`Void ${confirming.invoice.number}?`}
          intro={
            <>
              This voids <b>{confirming.invoice.number}</b> for{" "}
              <b>{confirming.invoice.customer.name}</b>, worth{" "}
              <b>{money(confirming.invoice.total)}</b>.
            </>
          }
          detail="It stays in your history and on the ledger, marked Void, and is excluded from every balance. Voiding cannot be undone."
          confirmLabel="Void invoice"
          busy={busy}
          error={
            error && (
              <WriteError
                error={error}
                canRetry={canRetry}
                busy={busy}
                onRetry={retryWrite}
                safe="Trying again will not void it twice."
              />
            )
          }
          onConfirm={() => void voidInvoice(confirming.invoice)}
          onCancel={() => {
            setConfirming(null);
            setError("");
          }}
        />
      )}
      {confirming?.kind === "deleteInvoice" && (
        <ConfirmDialog
          title={`Delete ${confirming.invoice.number}?`}
          intro={
            <>
              This permanently removes <b>{confirming.invoice.number}</b> for{" "}
              <b>{confirming.invoice.customer.name}</b>, worth{" "}
              <b>{money(confirming.invoice.total)}</b>.
            </>
          }
          detail={
            confirming.invoice.voided
              ? "It is already void and settles nothing, so no balance changes. It leaves your history and the ledger entirely, and its number is never reused — the gap in the numbering is all that will remain. This cannot be undone."
              : "Nothing has been paid against it, so no balance changes. It leaves your history and the ledger entirely, and its number is never reused — the gap in the numbering is all that will remain. If the invoice has already been sent to your customer, void it instead so your copy still matches theirs. This cannot be undone."
          }
          confirmPhrase={confirming.invoice.number}
          confirmLabel="Delete invoice"
          busy={busy}
          error={
            error && (
              <WriteError
                error={error}
                canRetry={canRetry}
                busy={busy}
                onRetry={retryWrite}
                safe="Trying again is safe."
              />
            )
          }
          onConfirm={() => void removeInvoice(confirming.invoice)}
          onCancel={() => {
            setConfirming(null);
            setError("");
          }}
        />
      )}
      {pendingPage && (
        <ConfirmDialog
          title="Leave without saving?"
          intro={
            <>
              Your business details have changes that have not been saved yet.
            </>
          }
          detail="A logo you have chosen is only a preview until you press Save details. Leaving now discards it."
          confirmLabel="Leave without saving"
          cancelLabel="Stay and save"
          busy={false}
          onConfirm={() => {
            const target = pendingPage;
            setPendingPage(null);
            setSettingsDirty(false);
            setPage(target);
            setSearch("");
            setFilter("All");
            window.scrollTo({ top: 0 });
          }}
          onCancel={() => setPendingPage(null)}
        />
      )}
      {confirming?.kind === "expense" && (
        <ConfirmDialog
          title="Delete this expense?"
          intro={
            <>
              This removes <b>{confirming.expense.description}</b> for{" "}
              <b>{money(confirming.expense.amount)}</b> on{" "}
              {dateLabel(confirming.expense.date)}.
            </>
          }
          detail="Expenses are your own record, so this affects nothing a customer holds. It cannot be undone."
          confirmLabel="Delete expense"
          busy={busy}
          error={
            error && (
              <WriteError
                error={error}
                canRetry={canRetry}
                busy={busy}
                onRetry={retryWrite}
                safe="Trying again is safe."
              />
            )
          }
          onConfirm={() => void removeExpense(confirming.expense)}
          onCancel={() => {
            setConfirming(null);
            setError("");
          }}
        />
      )}
      {confirming?.kind === "customer" && (
        <ConfirmDialog
          title="Delete this customer?"
          intro={
            <>
              This permanently deletes <b>{confirming.customer.name}</b> and
              their stored address, telephone, email and BRN.
            </>
          }
          detail="They have no invoices, so nothing on the ledger changes. Deleting cannot be undone."
          confirmPhrase={confirming.customer.name}
          confirmLabel="Delete customer"
          busy={busy}
          error={
            error && (
              <WriteError
                error={error}
                canRetry={canRetry}
                busy={busy}
                onRetry={retryWrite}
                safe="Trying again is safe."
              />
            )
          }
          onConfirm={() => void removeCustomer(confirming.customer)}
          onCancel={() => {
            setConfirming(null);
            setError("");
          }}
        />
      )}
    </div>
  );
}
