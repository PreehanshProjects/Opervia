import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  FileText,
  Plus,
  Receipt,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import Stat from "../components/Stat";
import InvoiceTable from "../components/InvoiceTable";
import { balance, money, roundMoney, type Data, type Invoice } from "../domain";
import type { Page } from "../lib/nav";

export default function Overview({
  data,
  demo,
  valid,
  overdue,
  outstanding,
  received,
  expenses,
  go,
  openNew,
  onOpenInvoice,
  onAddCustomer,
  onAddExpense,
  onReviewOverdue,
}: {
  data: Data;
  demo: boolean;
  valid: Invoice[];
  overdue: Invoice[];
  outstanding: number;
  received: number;
  expenses: number;
  go: (p: Page) => void;
  openNew: () => void;
  onOpenInvoice: (i: Invoice) => void;
  onAddCustomer: () => void;
  onAddExpense: () => void;
  onReviewOverdue: () => void;
}) {
  return (
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
              type="button"
              className="text-button"
              onClick={() => go("Invoices")}
            >
              View all <ArrowRight size={15} />
            </button>
          </div>
          <InvoiceTable
            invoices={[...data.invoices]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 5)}
            payments={data.payments}
            onOpen={onOpenInvoice}
            onNew={openNew}
          />
        </div>
        <div className="right-stack">
          <div className="collect-card">
            <div className="collect-icon">
              <Receipt size={23} />
            </div>
            <span className="eyebrow">A GENTLE REMINDER</span>
            <h2>{overdue.length ? "Time to follow up." : "Looking good."}</h2>
            <p>
              {overdue.length
                ? `${overdue.length} ${overdue.length === 1 ? "invoice is" : "invoices are"} past the due date. A friendly reminder can go a long way.`
                : "No overdue invoices. Keep your books up to date as your business grows."}
            </p>
            <strong>
              {money(
                overdue.reduce((s, i) => s + balance(i, data.payments), 0),
              )}
            </strong>
            <button type="button" onClick={onReviewOverdue}>
              Review overdue invoices <ArrowRight size={16} />
            </button>
          </div>
          <div className="panel quick-panel">
            <h3>Start something new</h3>
            <button type="button" onClick={openNew}>
              <span>
                <FileText size={18} />
                Create an invoice
              </span>
              <Plus size={16} />
            </button>
            <button type="button" onClick={onAddCustomer}>
              <span>
                <Users size={18} />
                Add a customer
              </span>
              <Plus size={16} />
            </button>
            <button type="button" onClick={onAddExpense}>
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
  );
}
