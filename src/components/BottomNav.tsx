import { mobileNav, type Page } from "../lib/nav";

/**
 * Mobile navigation. Five daily destinations in the thumb zone, one tap each;
 * Settings and sign-out live in the topbar. Hidden above 760px, where the
 * sidebar is the navigation.
 */
export default function BottomNav({
  page,
  unpaidCount,
  go,
}: {
  page: Page;
  unpaidCount: number;
  go: (p: Page) => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="Sections">
      {mobileNav.map((n) => {
        const active = page === n.name;
        return (
          <button
            key={n.name}
            type="button"
            className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}
            onClick={() => go(n.name)}
          >
            <span className="nav-icon">
              <n.icon size={20} strokeWidth={active ? 2.2 : 1.9} />
              {n.name === "Invoices" && !!unpaidCount && (
                <span className="nav-dot" aria-hidden="true">
                  {unpaidCount > 99 ? "99+" : unpaidCount}
                </span>
              )}
            </span>
            {n.name}
          </button>
        );
      })}
    </nav>
  );
}
