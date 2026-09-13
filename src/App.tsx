import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  Plus,
  Printer,
  RefreshCw,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import * as api from "./api";
import {
  type Customer,
  type Data,
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
  invoiceCountFor,
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
import { printDocument, saveTextFile } from "./lib/platform";
import { initBackButton, initNative } from "./lib/native";
import type { Modal, Page } from "./lib/nav";

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
  const [filter, setFilter] = useState("All");
  const [ledgerCustomer, setLedgerCustomer] = useState("");
  const [customerEdit, setCustomerEdit] = useState<Customer | undefined>();
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
    { kind: "void"; invoice: Invoice } | { kind: "customer"; customer: Customer } | null
  >(null);
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
  // Native shell wiring. Both are no-ops in the browser.
  useEffect(() => initNative(() => setRecovery(true)), []);
  // Android's back button reads through the same hierarchy the user sees:
  // stacked dialog, then dialog, then back to Overview, then leave the app.
  const backRef = useRef<() => boolean>(() => false);
  backRef.current = () => {
    if (busy) return true;
    if (confirming) {
      setConfirming(null);
      setError("");
      return true;
    }
    if (customerOverInvoice) {
      closeStackedCustomer();
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
      const next = await api.loadData();
      if (generation === loadGeneration.current) setData(next);
    } catch (e) {
      if (generation === loadGeneration.current) setError(errorText(e));
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }
  // Re-runs the last failed write. Every write carries a client-generated id and
  // the database functions are idempotent, so a retry cannot duplicate a record.
  const lastWrite = useRef<{ work: () => Promise<void>; success: string }>(null);
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
  async function sync() {
    if (!demo) {
      const next = await api.loadData();
      setData(next);
      return next;
    }
    return data;
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
      // Guarded again here: the list could have changed since the dialog opened.
      if (!canDeleteCustomer(customer.id, data.invoices))
        throw new Error(
          "This customer now has invoices, so their details stay on record.",
        );
      if (demo)
        setData((d) => ({
          ...d,
          customers: d.customers.filter((c) => c.id !== customer.id),
        }));
      else {
        await api.deleteCustomer(customer.id);
        await sync();
      }
    }, "Customer deleted");
    if (ok) {
      setConfirming(null);
      closeModal();
    }
  }
  // Printing is the deliverable, so a platform that cannot print must say so
  // rather than let the button appear to do nothing.
  async function print(documentName: string) {
    try {
      if (await printDocument(documentName)) return;
      setError(
        "Printing is not available on this device yet. Open Opervia in a browser to print or save a PDF.",
      );
    } catch (e) {
      setError(errorText(e));
    }
  }
  function go(p: Page) {
    setPage(p);
    setSearch("");
    setFilter("All");
    window.scrollTo({ top: 0 });
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
    setCustomerEdit(undefined);
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
  const valid = data.invoices.filter((i) => !i.voided);
  const outstanding = roundMoney(
    valid.reduce((s, i) => s + balance(i, data.payments), 0),
  );
  const received = roundMoney(data.payments.reduce((s, p) => s + p.amount, 0));
  const expenses = roundMoney(data.expenses.reduce((s, e) => s + e.amount, 0));
  const overdue = valid.filter((i) => status(i, data.payments) === "Overdue");
  const currentInvoice = selected
    ? (data.invoices.find((i) => i.id === selected.id) ?? selected)
    : undefined;
  const visibleInvoices = data.invoices
    .filter(
      (i) =>
        (filter === "All" || status(i, data.payments) === filter) &&
        `${i.number} ${i.customer.name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.number.localeCompare(a.number),
    );
  const ledgerRows = ledger(data, ledgerCustomer);
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
        <Topbar page={page} demo={demo} email={session?.user.email} go={go} logout={logout} />
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
                    ? "Your customer ledger."
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
                      "Every invoice and payment, with a running balance.",
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
                    void saveTextFile(
                      "opervia-ledger.csv",
                      toCsv([
                        [
                          "Date",
                          "Reference",
                          "Details",
                          "Type",
                          "Debit MUR",
                          "Credit MUR",
                          "Balance MUR",
                        ],
                        ...ledgerRows.map((r) => [
                          r.date,
                          r.label,
                          r.detail,
                          r.type,
                          r.debit,
                          r.credit,
                          r.balance,
                        ]),
                      ]),
                      CSV_MIME,
                    )
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
                  data={data}
                  demo={demo}
                  valid={valid}
                  overdue={overdue}
                  outstanding={outstanding}
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
                  invoices={visibleInvoices}
                  payments={data.payments}
                  filter={filter}
                  setFilter={setFilter}
                  search={search}
                  setSearch={setSearch}
                  onOpen={openInvoice}
                  onNew={openNew}
                />
              )}
              {page === "Ledger" && (
                <Ledger
                  rows={ledgerRows}
                  customers={data.customers}
                  ledgerCustomer={ledgerCustomer}
                  setLedgerCustomer={setLedgerCustomer}
                />
              )}
              {page === "Customers" && (
                <Customers
                  customers={data.customers}
                  valid={valid}
                  payments={data.payments}
                  search={search}
                  setSearch={setSearch}
                  onOpen={(c) => {
                    setCustomerEdit(c);
                    setModal("customer");
                  }}
                />
              )}
              {page === "Expenses" && (
                <Expenses expenses={data.expenses} total={expenses} />
              )}
              {page === "Settings" && (
                <BusinessForm
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
      <BottomNav page={page} unpaidCount={data.invoices.filter((i) => !i.voided).length} go={go} />
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
            invoiceCount={
              customerEdit
                ? invoiceCountFor(customerEdit.id, data.invoices)
                : 0
            }
            onDelete={
              customerEdit &&
              canDeleteCustomer(customerEdit.id, data.invoices)
                ? () =>
                    setConfirming({ kind: "customer", customer: customerEdit })
                : undefined
            }
            onSave={async (customer) => {
              const ok = await act(async () => {
                if (demo)
                  setData((d) => ({
                    ...d,
                    customers: [
                      ...d.customers.filter((c) => c.id !== customer.id),
                      customer,
                    ],
                  }));
                else {
                  await api.saveCustomer(customer);
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
        <ModalShell title="Record an expense" onClose={closeModal}>
          <ExpenseForm
            busy={busy}
            onSave={async (expense) => {
              const ok = await act(async () => {
                if (demo)
                  setData((d) => ({
                    ...d,
                    expenses: [...d.expenses, expense],
                  }));
                else {
                  await api.saveExpense(expense);
                  await sync();
                }
              }, "Expense recorded");
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
            <button
              type="button"
              className="btn primary"
              onClick={() => void print("Blank invoice sheet")}
            >
              <Printer size={17} />
              Print / Save PDF
            </button>
          </div>
          <div className="print-area">
            <InvoicePrint business={data.business} payments={[]} blank />
          </div>
        </ModalShell>
      )}
      {modal === "invoice" && (
        <ModalShell
          title={
            selected
              ? `${selected.number} · ${selected.customer.name}`
              : "Create an invoice"
          }
          wide
          suspended={customerOverInvoice || !!confirming}
          onClose={closeModal}
        >
          {currentInvoice ? (
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
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => invoiceAgain(currentInvoice)}
                  >
                    <Copy size={16} />
                    Invoice again
                  </button>
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
                data={data}
                busy={busy}
                template={template}
                presetCustomer={presetCustomer}
                onPresetConsumed={() => setPresetCustomer("")}
                onAddCustomer={() => {
                  setCustomerEdit(undefined);
                  setError("");
                  setCustomerOverInvoice(true);
                }}
                onSave={async (input) => {
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
                      const next = await sync();
                      setSelected(
                        next.invoices.find((i) => i.id === input.id)!,
                      );
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
