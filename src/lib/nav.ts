import {
  BookOpen,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

export type Page =
  "Overview" | "Invoices" | "Ledger" | "Customers" | "Expenses" | "Settings";
export type Modal =
  "invoice" | "customer" | "expense" | "blank" | "statement" | null;

export const nav = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Invoices", icon: FileText },
  { name: "Ledger", icon: BookOpen },
  { name: "Customers", icon: Users },
  { name: "Expenses", icon: Wallet },
  { name: "Settings", icon: Settings },
] as const;

// A bottom bar tops out at five destinations before it stops being scannable.
// Settings is set once and then rarely touched, so it is the one that leaves.
export const mobileNav = nav.filter((n) => n.name !== "Settings");
