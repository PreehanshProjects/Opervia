import { ArrowRight, LogOut, ShieldCheck } from "lucide-react";
import Brand from "../Brand";
import { nav, type Page } from "../lib/nav";
import type { Data } from "../domain";

/** Desktop navigation. Below 760px this is hidden and BottomNav takes over. */
export default function Sidebar({
  data,
  page,
  demo,
  go,
  logout,
}: {
  data: Data;
  page: Page;
  demo: boolean;
  go: (p: Page) => void;
  logout: () => void;
}) {
  return (
    <aside className="sidebar">
      <a
        href="#"
        className="brand"
        onClick={(e) => {
          e.preventDefault();
          go("Overview");
        }}
      >
        <Brand />
      </a>
      <div className="workspace">
        <span className="workspace-avatar">{data.business.name.charAt(0)}</span>
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
            type="button"
            className={page === n.name ? "active" : ""}
            aria-current={page === n.name ? "page" : undefined}
            onClick={() => go(n.name)}
          >
            <n.icon size={19} />
            {n.name}
            {n.name === "Invoices" && (
              <span className="nav-count">
                {data.invoices.filter((i) => !i.voided).length}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="sidebar-note">
        <span className="note-symbol">✦</span>
        <b>A little more clarity.</b>
        <p>Keep your invoices, payments and everyday books in one place.</p>
        <button type="button" onClick={() => go("Settings")}>
          Make it yours <ArrowRight size={14} />
        </button>
      </div>
      <div className="sidebar-bottom">
        <ShieldCheck size={17} />
        <span>{demo ? "Sample workspace" : "Private workspace"}</span>
        <button
          type="button"
          onClick={logout}
          className="icon-button"
          aria-label={demo ? "Exit demo" : "Sign out"}
        >
          <LogOut size={17} />
        </button>
      </div>
    </aside>
  );
}
