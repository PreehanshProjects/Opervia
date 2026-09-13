import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  ChevronRight,
  CircleHelp,
  Download,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Printer,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
  Check,
  RefreshCw,
  Trash2,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import * as api from "./api";
import {
  type Business,
  type Customer,
  type Data,
  type Invoice,
  type InvoiceInput,
  type Item,
  type Payment,
  emptyData,
  today,
  plusDays,
  money,
  dateLabel,
  totals,
  lineTotal,
  paid,
  balance,
  status,
  validateInvoice,
  ledger,
  downloadCsv,
  roundMoney,
} from "./domain";
import { makeDemo } from "./demo";
import Auth from "./Auth";
import InvoicePrint from "./InvoicePrint";

type Page =
  "Overview" | "Invoices" | "Ledger" | "Customers" | "Expenses" | "Settings";
type Modal = "invoice" | "customer" | "expense" | "blank" | null;
const nav = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Invoices", icon: FileText },
  { name: "Ledger", icon: BookOpen },
  { name: "Customers", icon: Users },
  { name: "Expenses", icon: Wallet },
  { name: "Settings", icon: Settings },
] as const;
function ModalShell({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const first = ref.current?.querySelector<HTMLElement>(
      "button,input,select,textarea",
    );
    first?.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const elements = [
          ...ref.current!.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
          ),
        ];
        const first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      prev?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "modal-wide" : ""}`}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <FileText size={32} />
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
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
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [ledgerCustomer, setLedgerCustomer] = useState("");
  const [customerEdit, setCustomerEdit] = useState<Customer | undefined>();
  const [paymentOpen, setPaymentOpen] = useState(false);
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
        }
      },
    );
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (session && !demo && !recovery) void refresh();
  }, [session?.user.id, demo, recovery]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
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
  function errorText(e: unknown) {
    return e instanceof Error
      ? e.message
      : typeof e === "object" && e && "message" in e
        ? String(e.message)
        : "Something went wrong. Please try again.";
  }
  async function act(work: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await work();
      setNotice(success);
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function sync() {
    if (!demo) {
      const next = await api.loadData();
      setData(next);
      return next;
    }
    return data;
  }
  function go(p: Page) {
    setPage(p);
    setMobile(false);
    setSearch("");
    setFilter("All");
  }
  function openNew() {
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
    setError("");
  }
  async function logout() {
    if (demo) {
      setDemo(false);
      setData(emptyData());
      go("Overview");
      return;
    }
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
  const invoiceTable = (invoices: Invoice[]) =>
    invoices.length ? (
      <div className="table-scroll">
        <table className="data-table invoice-list-table">
          <thead>
            <tr>
              <th>INVOICE / CUSTOMER</th>
              <th>DATE</th>
              <th>AMOUNT</th>
              <th>BALANCE</th>
              <th>STATUS</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id}>
                <td>
                  <button
                    className="table-link"
                    onClick={() => {
                      setSelected(i);
                      setModal("invoice");
                    }}
                  >
                    {i.number}
                  </button>
                  <small>{i.customer.name}</small>
                </td>
                <td>{dateLabel(i.date)}</td>
                <td className="number">{money(i.total)}</td>
                <td className="number">{money(balance(i, data.payments))}</td>
                <td>
                  <span
                    className={`badge ${status(i, data.payments).toLowerCase()}`}
                  >
                    {status(i, data.payments)}
                  </span>
                </td>
                <td>
                  <button
                    aria-label={`View ${i.number}`}
                    className="icon-button"
                    onClick={() => {
                      setSelected(i);
                      setModal("invoice");
                    }}
                  >
                    <ChevronRight size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="No invoices here yet"
        detail="Create an invoice and give your paperwork a fresh start."
        action={
          <button className="btn primary" onClick={openNew}>
            <Plus size={16} />
            Create invoice
          </button>
        }
      />
    );
  if (authLoading)
    return <div className="loading-screen">Opening Opervia…</div>;
  if ((!session && !demo) || recovery)
    return (
      <Auth
        onDemo={() => {
          setDemo(true);
          setData(makeDemo());
          setError("");
        }}
        recovery={recovery}
        onRecovered={() => setRecovery(false)}
      />
    );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            go("Overview");
          }}
        >
          <span className="brand-mark">
            <BookOpen size={23} />
          </span>
          opervia<span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">
            {data.business.name.charAt(0)}
          </span>
          <div>
            <b>{data.business.name}</b>
            <small>Business workspace</small>
          </div>
          <span className="workspace-status" />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {nav.map((n) => (
            <button
              key={n.name}
              className={page === n.name ? "active" : ""}
              onClick={() => go(n.name)}
            >
              <n.icon size={19} />
              {n.name}
              {n.name === "Invoices" && (
                <span className="nav-count">{data.invoices.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-symbol">✦</span>
          <b>A little more clarity.</b>
          <p>Keep your invoices, payments and everyday books in one place.</p>
          <button onClick={() => go("Settings")}>
            Make it yours <ArrowRight size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <ShieldCheck size={17} />
          <span>{demo ? "Sample workspace" : "Private workspace"}</span>
          <button
            onClick={logout}
            className="icon-button"
            aria-label={demo ? "Exit demo" : "Sign out"}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="app-main">
        <header className="topbar">
          <div>
            <button
              className="icon-button menu-toggle"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              Workspace <ChevronRight size={13} /> <b>{page}</b>
            </span>
          </div>
          <div className="topbar-right">
            <span className={`connection ${demo ? "demo" : ""}`}>
              <i />
              {demo ? "Demo mode" : "Cloud workspace"}
            </span>
            <button
              className="icon-button"
              onClick={() => go("Settings")}
              aria-label="Workspace settings"
            >
              <CircleHelp size={19} />
            </button>
            <span className="user-avatar">
              {(session?.user.email ?? "Demo").slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
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
                    downloadCsv("opervia-ledger.csv", [
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
                    ])
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
                <>
                  <section className="stats-grid">
                    <Stat
                      title="Outstanding invoices"
                      value={money(outstanding)}
                      hint={`${valid.filter((i) => balance(i, data.payments) > 0).length} invoices awaiting payment`}
                      icon={<FileText size={19} />}
                      featured
                    />
                    <Stat
                      title="Payments received"
                      value={money(received)}
                      hint="All recorded customer payments"
                      icon={<ArrowDownLeft size={20} />}
                    />
                    <Stat
                      title="Business expenses"
                      value={money(expenses)}
                      hint={`${data.expenses.length} expenses recorded`}
                      icon={<ArrowUpRight size={20} />}
                    />
                    <Stat
                      title="Net cash movement"
                      value={money(roundMoney(received - expenses))}
                      hint="Payments received minus expenses"
                      icon={<Wallet size={19} />}
                    />
                  </section>
                  <section className="overview-grid">
                    <div className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Recent invoices</h2>
                          <p>Your latest business, all in one place.</p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => go("Invoices")}
                        >
                          View all <ArrowRight size={15} />
                        </button>
                      </div>
                      {invoiceTable(
                        [...data.invoices]
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .slice(0, 5),
                      )}
                    </div>
                    <div className="right-stack">
                      <div className="collect-card">
                        <div className="collect-icon">
                          <Receipt size={23} />
                        </div>
                        <span className="eyebrow">A GENTLE REMINDER</span>
                        <h2>
                          {overdue.length
                            ? "Time to follow up."
                            : "Looking good."}
                        </h2>
                        <p>
                          {overdue.length
                            ? `${overdue.length} ${overdue.length === 1 ? "invoice is" : "invoices are"} past the due date. A friendly reminder can go a long way.`
                            : "No overdue invoices. Keep your books up to date as your business grows."}
                        </p>
                        <strong>
                          {money(
                            overdue.reduce(
                              (s, i) => s + balance(i, data.payments),
                              0,
                            ),
                          )}
                        </strong>
                        <button
                          onClick={() => {
                            go("Invoices");
                            setFilter("Overdue");
                          }}
                        >
                          Review overdue invoices <ArrowRight size={16} />
                        </button>
                      </div>
                      <div className="panel quick-panel">
                        <h3>Start something new</h3>
                        <button onClick={openNew}>
                          <span>
                            <FileText size={18} />
                            Create an invoice
                          </span>
                          <Plus size={16} />
                        </button>
                        <button onClick={() => setModal("customer")}>
                          <span>
                            <Users size={18} />
                            Add a customer
                          </span>
                          <Plus size={16} />
                        </button>
                        <button onClick={() => setModal("expense")}>
                          <span>
                            <Wallet size={18} />
                            Record an expense
                          </span>
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </section>
                  <div className="bottom-note">
                    <ShieldCheck size={16} />
                    {demo
                      ? "Explore freely. These are fictional transactions, inspired by your invoice format."
                      : "Your invoices and payments are stored in your private Supabase workspace."}
                    <span>MUR · Mauritian rupee</span>
                  </div>
                </>
              )}
              {page === "Invoices" && (
                <section className="panel">
                  <div className="list-toolbar">
                    <div className="tabs">
                      {[
                        "All",
                        "Unpaid",
                        "Partial",
                        "Paid",
                        "Overdue",
                        "Void",
                      ].map((f) => (
                        <button
                          className={filter === f ? "active" : ""}
                          key={f}
                          onClick={() => setFilter(f)}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    <div className="search-box">
                      <Search size={17} />
                      <input
                        aria-label="Search invoices"
                        placeholder="Search invoices…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  {invoiceTable(visibleInvoices)}
                </section>
              )}
              {page === "Ledger" && (
                <>
                  <div className="ledger-summary">
                    <div>
                      <span>CUSTOMER BALANCE</span>
                      <h2>{money(ledgerRows.at(-1)?.balance ?? 0)}</h2>
                      <p>Invoices less payments · expenses shown separately</p>
                    </div>
                    <label>
                      View customer
                      <select
                        value={ledgerCustomer}
                        onChange={(e) => setLedgerCustomer(e.target.value)}
                      >
                        <option value="">All customers</option>
                        {data.customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <section className="panel">
                    {ledgerRows.length ? (
                      <div className="table-scroll">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>DATE</th>
                              <th>ENTRY</th>
                              <th>DEBIT</th>
                              <th>CREDIT</th>
                              <th>RUNNING BALANCE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ledgerRows.map((r) => (
                              <tr key={r.id}>
                                <td>{dateLabel(r.date)}</td>
                                <td>
                                  <b>{r.label}</b>
                                  <small>{r.detail}</small>
                                </td>
                                <td className="number">
                                  {r.debit ? money(r.debit) : "—"}
                                </td>
                                <td className="number green">
                                  {r.credit ? money(r.credit) : "—"}
                                </td>
                                <td className="number">
                                  <b>{money(r.balance)}</b>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty
                        title="A clean page"
                        detail="Invoices and payments will appear here automatically."
                      />
                    )}
                  </section>
                </>
              )}
              {page === "Customers" && (
                <>
                  <div className="search-box standalone">
                    <Search size={17} />
                    <input
                      aria-label="Search customers"
                      placeholder="Find a customer…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="customer-grid">
                    {data.customers
                      .filter((c) =>
                        c.name.toLowerCase().includes(search.toLowerCase()),
                      )
                      .map((c) => (
                        <button
                          className="customer-card"
                          key={c.id}
                          onClick={() => {
                            setCustomerEdit(c);
                            setModal("customer");
                          }}
                        >
                          <div className="customer-top">
                            <span className="customer-avatar">
                              {c.name
                                .split(" ")
                                .slice(0, 2)
                                .map((n) => n[0])
                                .join("")}
                            </span>
                            <ChevronRight size={18} />
                          </div>
                          <h3>{c.name}</h3>
                          <p>{c.address || "No address added"}</p>
                          <div>
                            <span>Outstanding</span>
                            <b>
                              {money(
                                valid
                                  .filter((i) => i.customer_id === c.id)
                                  .reduce(
                                    (s, i) => s + balance(i, data.payments),
                                    0,
                                  ),
                              )}
                            </b>
                          </div>
                        </button>
                      ))}
                  </div>
                  {!data.customers.length && (
                    <Empty
                      title="Meet your first customer"
                      detail="Save their details once. Use them on every invoice."
                    />
                  )}
                </>
              )}
              {page === "Expenses" && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Everyday expenses</h2>
                      <p>Total recorded: {money(expenses)}</p>
                    </div>
                    <button
                      className="btn secondary"
                      onClick={() =>
                        downloadCsv("opervia-expenses.csv", [
                          ["Date", "Description", "Category", "Amount MUR"],
                          ...data.expenses.map((e) => [
                            e.date,
                            e.description,
                            e.category,
                            e.amount,
                          ]),
                        ])
                      }
                    >
                      <Download size={15} />
                      Export CSV
                    </button>
                  </div>
                  {data.expenses.length ? (
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>DATE</th>
                            <th>DESCRIPTION</th>
                            <th>CATEGORY</th>
                            <th>AMOUNT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...data.expenses]
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .map((e) => (
                              <tr key={e.id}>
                                <td>{dateLabel(e.date)}</td>
                                <td>
                                  <b>{e.description}</b>
                                </td>
                                <td>
                                  <span className="badge neutral">
                                    {e.category}
                                  </span>
                                </td>
                                <td className="number">{money(e.amount)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      title="Nothing spent, nothing missed"
                      detail="Record fuel, supplies, rent, and other business expenses."
                    />
                  )}
                </section>
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
          <span>
            opervia<span className="brand-dot">.</span>
          </span>{" "}
          Your business, in balance.
        </footer>
      </div>
      {modal === "customer" && (
        <ModalShell
          title={customerEdit ? "Customer details" : "A new connection"}
          onClose={closeModal}
        >
          <CustomerForm
            customer={customerEdit}
            busy={busy}
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
              if (ok) closeModal();
            }}
          />
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
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
            <div className="error" role="alert">
              {error}
            </div>
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
            <button className="btn primary" onClick={() => window.print()}>
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
                        className="btn primary"
                        onClick={() => setPaymentOpen((v) => !v)}
                      >
                        <Plus size={16} />
                        Record payment
                      </button>
                    )}
                  <button
                    className="btn secondary"
                    onClick={() => window.print()}
                  >
                    <Printer size={16} />
                    Print / Save PDF
                  </button>
                  {!currentInvoice.voided &&
                    paid(currentInvoice, data.payments) === 0 && (
                      <button
                        className="btn danger"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Void this invoice? It will remain in your history and be excluded from balances.",
                            )
                          )
                            void act(async () => {
                              if (demo)
                                setData((d) => ({
                                  ...d,
                                  invoices: d.invoices.map((i) =>
                                    i.id === currentInvoice.id
                                      ? { ...i, voided: true }
                                      : i,
                                  ),
                                }));
                              else {
                                await api.voidInvoice(currentInvoice.id);
                                await sync();
                              }
                            }, "Invoice voided");
                        }}
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
                <div className="error" role="alert">
                  {error}
                </div>
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
                onAddCustomer={() => setModal("customer")}
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
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
            </>
          )}
        </ModalShell>
      )}
    </div>
  );
}
function Stat({
  title,
  value,
  hint,
  icon,
  featured = false,
}: {
  title: string;
  value: string;
  hint: string;
  icon: ReactNode;
  featured?: boolean;
}) {
  return (
    <div className={`stat-card ${featured ? "featured" : ""}`}>
      <div>
        <span>{title}</span>
        <i>{icon}</i>
      </div>
      <strong>{value}</strong>
      <p>{hint}</p>
    </div>
  );
}
function CustomerForm({
  customer,
  busy,
  onSave,
}: {
  customer?: Customer;
  busy: boolean;
  onSave: (c: Customer) => Promise<void>;
}) {
  const [form, setForm] = useState<Customer>(
    customer ?? {
      id: crypto.randomUUID(),
      name: "",
      address: "",
      phone: "",
      email: "",
      brn: "",
    },
  );
  return (
    <form
      className="form-body"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ ...form, name: form.name.trim() });
      }}
    >
      <p className="form-intro">
        Customer details are copied onto new invoices. Existing invoices keep
        their original details.
      </p>
      <div className="form-grid">
        {(["name", "address", "phone", "email", "brn"] as const).map((k) => (
          <label key={k} className={k === "address" ? "full" : ""}>
            {
              {
                name: "Customer name",
                address: "Address",
                phone: "Telephone",
                email: "Email address",
                brn: "Business registration no.",
              }[k]
            }
            <input
              required={k === "name"}
              maxLength={k === "address" ? 500 : 200}
              type={k === "email" ? "email" : k === "phone" ? "tel" : "text"}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <button className="btn primary" disabled={busy || !form.name.trim()}>
        {busy ? "Saving…" : "Save customer"}
        <Check size={16} />
      </button>
    </form>
  );
}
function BusinessForm({
  business,
  busy,
  demo,
  email,
  onSave,
}: {
  business: Business;
  busy: boolean;
  demo: boolean;
  email?: string;
  onSave: (b: Business) => Promise<void>;
}) {
  const [form, setForm] = useState(business);
  return (
    <div className="settings-grid">
      <form
        className="panel form-body"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(form);
        }}
      >
        <h2>Your business details</h2>
        <p className="form-intro">
          For an individually registered business or a company. Enter your
          trading name and BRN as registered; a company registration number is
          not required. These details appear on new invoices and blank invoice
          sheets.
        </p>
        <div className="form-grid">
          {(
            [
              "name",
              "proprietor",
              "subtitle",
              "address",
              "phone",
              "email",
              "brn",
            ] as const
          ).map((k) => (
            <label key={k} className={k === "address" ? "full" : ""}>
              {
                {
                  name: "Business name",
                  proprietor:
                    "Proprietor / registered person's name (optional)",
                  subtitle: "Business description",
                  address: "Business address",
                  phone: "Telephone",
                  email: "Email address",
                  brn: "Business registration number (BRN)",
                }[k]
              }
              <input
                required={k === "name"}
                maxLength={500}
                type={k === "email" ? "email" : k === "phone" ? "tel" : "text"}
                value={form[k] ?? ""}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <h3>Bank details for invoices</h3>
        <p className="form-intro">
          Optional. Saved bank details are printed on new invoices and blank
          sheets so customers know where to pay.
        </p>
        <div className="form-grid">
          {(["bankName", "accountName", "accountNumber"] as const).map((k) => (
            <label key={k}>
              {
                {
                  bankName: "Bank name",
                  accountName: "Account holder name",
                  accountNumber: "Bank account number",
                }[k]
              }
              <input
                type="text"
                maxLength={k === "accountNumber" ? 100 : 200}
                value={form[k] ?? ""}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </label>
          ))}
          <label className="full">
            Payment terms
            <textarea
              rows={4}
              maxLength={2000}
              value={form.terms}
              onChange={(e) => setForm({ ...form, terms: e.target.value })}
            />
          </label>
        </div>
        <button disabled={busy || !form.name.trim()} className="btn primary">
          {busy ? "Saving…" : "Save details"}
          <Check size={16} />
        </button>
      </form>
      <div className="panel form-body security-card">
        <ShieldCheck size={27} />
        <h3>A private place for your books</h3>
        <p>
          {demo ? "You are using an in-memory demo." : `Signed in as ${email}`}
        </p>
        <ul>
          <li>One private workspace per account</li>
          <li>Database rules isolate your records</li>
          <li>Issued invoices keep their original details</li>
          <li>Payments cannot exceed the balance</li>
        </ul>
        <div className="settings-currency">
          <b>MUR</b>
          <span>
            Mauritian rupee
            <br />
            <small>Workspace currency</small>
          </span>
        </div>
        <p className="micro">
          Staff sharing and full double-entry accounting are outside this first
          version. Keep your own exported records and configure database backups
          before live use.
        </p>
      </div>
    </div>
  );
}
function InvoiceForm({
  data,
  busy,
  onSave,
  onAddCustomer,
}: {
  data: Data;
  busy: boolean;
  onSave: (i: InvoiceInput) => Promise<boolean>;
  onAddCustomer: () => void;
}) {
  const [input, setInput] = useState<InvoiceInput>({
    id: crypto.randomUUID(),
    customer_id: "",
    date: today(),
    due_date: plusDays(today(), 30),
    items: [
      { description: "", quantity: 1, unit: "pc", price: 0, section: "" },
    ],
    notes: "",
    tax_rate: 0,
    deposit: 0,
    method: "Cash",
  });
  const [error, setError] = useState("");
  const sums = totals(input.items, input.tax_rate);
  function changeItem(index: number, key: keyof Item, value: string | number) {
    setInput({
      ...input,
      items: input.items.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    });
  }
  return (
    <form
      className="form-body invoice-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          validateInvoice(input);
          await onSave(input);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Check the invoice details.",
          );
        }
      }}
    >
      <div className="form-grid three">
        <label>
          Customer
          <select
            required
            value={input.customer_id}
            onChange={(e) =>
              setInput({ ...input, customer_id: e.target.value })
            }
          >
            <option value="">Choose a customer</option>
            {data.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Invoice date
          <input
            type="date"
            required
            value={input.date}
            onChange={(e) => setInput({ ...input, date: e.target.value })}
          />
        </label>
        <label>
          Due date
          <input
            type="date"
            min={input.date}
            required
            value={input.due_date}
            onChange={(e) => setInput({ ...input, due_date: e.target.value })}
          />
        </label>
      </div>
      {!data.customers.length && (
        <div className="setup-note">
          Add your first customer before creating an invoice.
          <button type="button" className="text-button" onClick={onAddCustomer}>
            Add customer <Plus size={14} />
          </button>
        </div>
      )}
      <div className="form-section-heading">
        <h3>Invoice items</h3>
        <span>All amounts in MUR</span>
      </div>
      <div className="item-list">
        {input.items.map((item, i) => (
          <div className="item-row" key={i}>
            <label className="item-description">
              Description
              <input
                aria-label={`Item ${i + 1} description`}
                required
                maxLength={500}
                placeholder="e.g. Roma tomatoes"
                value={item.description}
                onChange={(e) => changeItem(i, "description", e.target.value)}
              />
            </label>
            <label>
              Qty
              <input
                aria-label={`Item ${i + 1} quantity`}
                type="number"
                min="0.001"
                max="1000000"
                step="0.001"
                required
                value={item.quantity}
                onChange={(e) =>
                  changeItem(i, "quantity", Number(e.target.value))
                }
              />
            </label>
            <label>
              Unit
              <select
                aria-label={`Item ${i + 1} unit`}
                value={item.unit}
                onChange={(e) => changeItem(i, "unit", e.target.value)}
              >
                {[
                  "pc",
                  "kg",
                  "g",
                  "box",
                  "pack",
                  "litre",
                  "hour",
                  "service",
                ].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
            <label>
              Unit price
              <input
                aria-label={`Item ${i + 1} price`}
                type="number"
                min="0"
                max="100000000"
                step="0.01"
                required
                value={item.price}
                onChange={(e) => changeItem(i, "price", Number(e.target.value))}
              />
            </label>
            <label className="item-section">
              Section
              <input
                aria-label={`Item ${i + 1} section`}
                maxLength={100}
                placeholder="Optional"
                value={item.section}
                onChange={(e) => changeItem(i, "section", e.target.value)}
              />
            </label>
            <div className="item-total">
              <span>Amount</span>
              <b>{money(lineTotal(item))}</b>
            </div>
            <button
              type="button"
              disabled={input.items.length === 1}
              aria-label={`Remove item ${i + 1}`}
              className="icon-button"
              onClick={() =>
                setInput({
                  ...input,
                  items: input.items.filter((_, j) => j !== i),
                })
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn secondary"
        disabled={input.items.length >= 100}
        onClick={() =>
          setInput({
            ...input,
            items: [
              ...input.items,
              {
                description: "",
                quantity: 1,
                unit: "pc",
                price: 0,
                section: "",
              },
            ],
          })
        }
      >
        <Plus size={15} />
        Add item
      </button>
      <div className="invoice-form-bottom">
        <div>
          <label>
            Notes
            <textarea
              rows={3}
              maxLength={2000}
              placeholder="A note for your customer…"
              value={input.notes}
              onChange={(e) => setInput({ ...input, notes: e.target.value })}
            />
          </label>
          <div className="form-grid">
            <label>
              Deposit received
              <input
                type="number"
                min="0"
                max={sums.total}
                step="0.01"
                value={input.deposit}
                onChange={(e) =>
                  setInput({ ...input, deposit: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Payment method
              <select
                value={input.method}
                onChange={(e) => setInput({ ...input, method: e.target.value })}
              >
                {["Cash", "Bank transfer", "Card", "Cheque", "Other"].map(
                  (m) => (
                    <option key={m}>{m}</option>
                  ),
                )}
              </select>
            </label>
          </div>
        </div>
        <div className="invoice-summary">
          <p>
            <span>Subtotal</span>
            <b>{money(sums.subtotal)}</b>
          </p>
          <label>
            Tax rate (%)
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={input.tax_rate}
              onChange={(e) =>
                setInput({ ...input, tax_rate: Number(e.target.value) })
              }
            />
          </label>
          <p>
            <span>Tax</span>
            <b>{money(sums.tax)}</b>
          </p>
          <p className="total-line">
            <span>Total</span>
            <strong>{money(sums.total)}</strong>
          </p>
          <p>
            <span>Balance after deposit</span>
            <b>{money(roundMoney(sums.total - input.deposit))}</b>
          </p>
        </div>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="form-footer">
        <p>
          Creating an invoice posts it to the ledger. Check your details before
          saving.
        </p>
        <button
          className="btn primary"
          disabled={busy || !data.customers.length}
        >
          {busy ? "Creating…" : "Create invoice"}
          <ArrowRight size={17} />
        </button>
      </div>
    </form>
  );
}
function PaymentForm({
  invoice,
  payments,
  busy,
  onSave,
}: {
  invoice: Invoice;
  payments: Payment[];
  busy: boolean;
  onSave: (p: Payment) => Promise<void>;
}) {
  const [form, setForm] = useState<Payment>({
    id: crypto.randomUUID(),
    invoice_id: invoice.id,
    date: today(),
    amount: balance(invoice, payments),
    method: "Cash",
    reference: "",
  });
  return (
    <form
      className="payment-form"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(form);
      }}
    >
      <div className="form-grid three">
        <label>
          Amount (MUR)
          <input
            type="number"
            required
            min="0.01"
            max={balance(invoice, payments)}
            step="0.01"
            value={form.amount}
            onChange={(e) =>
              setForm({ ...form, amount: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Payment date
          <input
            type="date"
            required
            min={invoice.date}
            max={today()}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </label>
        <label>
          Method
          <select
            value={form.method}
            onChange={(e) => setForm({ ...form, method: e.target.value })}
          >
            {["Cash", "Bank transfer", "Card", "Cheque", "Other"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>
          Reference
          <input
            maxLength={200}
            placeholder="Optional"
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
          />
        </label>
      </div>
      <button className="btn primary" disabled={busy}>
        {busy ? "Saving…" : "Save payment"}
      </button>
    </form>
  );
}
function ExpenseForm({
  busy,
  onSave,
}: {
  busy: boolean;
  onSave: (e: Data["expenses"][number]) => Promise<void>;
}) {
  const [form, setForm] = useState({
    id: crypto.randomUUID(),
    date: today(),
    description: "",
    category: "Supplies",
    amount: 0,
  });
  return (
    <form
      className="form-body"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(form);
      }}
    >
      <div className="form-grid">
        <label className="full">
          Description
          <input
            maxLength={500}
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label>
          Date
          <input
            type="date"
            max={today()}
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </label>
        <label>
          Amount (MUR)
          <input
            type="number"
            required
            min="0.01"
            max="100000000"
            step="0.01"
            value={form.amount}
            onChange={(e) =>
              setForm({ ...form, amount: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Category
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {[
              "Supplies",
              "Transport",
              "Stock purchases",
              "Rent",
              "Utilities",
              "Other",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="btn primary"
        disabled={busy || !form.description.trim()}
      >
        {busy ? "Saving…" : "Save expense"}
        <Check size={16} />
      </button>
    </form>
  );
}
