export type Theme = "light" | "dark" | "system";

const KEY = "opervia:theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "light" || stored === "dark" || stored === "system")
      return stored;
  } catch {
    // Private mode. Fall back to following the device.
  }
  return "system";
}

/** What the chosen theme currently resolves to. */
export const resolveTheme = (theme: Theme): "light" | "dark" =>
  theme === "system" ? (media().matches ? "dark" : "light") : theme;

/**
 * Applies the theme to the document. `data-theme` is only ever "light" or
 * "dark" so the CSS never has to know about the "system" case.
 */
let settle: ReturnType<typeof setTimeout> | undefined;

export function applyTheme(theme: Theme, animate = false) {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  // The cross-fade is armed only for the moment of the change, then removed.
  if (animate && root.dataset.theme && root.dataset.theme !== resolved) {
    root.classList.add("theme-changing");
    clearTimeout(settle);
    settle = setTimeout(() => root.classList.remove("theme-changing"), 320);
  }
  root.dataset.theme = resolved;
  // The browser chrome and the Android status bar read this.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#0e1a16" : "#f7f8f5");
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Not persisting is survivable; the session still looks right.
  }
  return resolved;
}

/** Re-applies when the device flips, but only while following the system. */
export function watchSystemTheme(onChange: () => void) {
  const m = media();
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
}
