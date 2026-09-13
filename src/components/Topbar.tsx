import { ChevronRight, LogOut, Settings } from "lucide-react";
import ThemeSwitch from "./ThemeSwitch";
import type { Theme } from "../lib/theme";
import type { Page } from "../lib/nav";

export default function Topbar({
  page,
  demo,
  email,
  theme,
  onTheme,
  go,
  logout,
}: {
  page: Page;
  demo: boolean;
  email?: string;
  theme: Theme;
  onTheme: (t: Theme) => void;
  go: (p: Page) => void;
  logout: () => void;
}) {
  return (
    <header className="topbar">
      <div>
        <img
          className="topbar-mark"
          src="/favicon.svg?v=2"
          width="30"
          height="30"
          alt=""
          aria-hidden="true"
        />
        <span className="breadcrumb">
          Workspace <ChevronRight size={13} /> <b>{page}</b>
        </span>
      </div>
      <div className="topbar-right">
        <span className={`connection ${demo ? "demo" : ""}`}>
          <i />
          {demo ? "Demo mode" : "Cloud workspace"}
        </span>
        <ThemeSwitch theme={theme} onChange={onTheme} compact />
        {/* Settings leaves the bottom bar: it is configured once, not daily.
            Sign-out follows it here so both stay reachable without a drawer. */}
        <button
          type="button"
          className="icon-button topbar-settings"
          onClick={() => go("Settings")}
          aria-label="Settings"
        >
          <Settings size={19} />
        </button>
        <button
          type="button"
          className="icon-button topbar-signout"
          onClick={logout}
          aria-label={demo ? "Exit demo" : "Sign out"}
        >
          <LogOut size={18} />
        </button>
        <span className="user-avatar" title={email ?? "Demo workspace"}>
          {(email ?? "Demo").slice(0, 1).toUpperCase()}
        </span>
      </div>
    </header>
  );
}
