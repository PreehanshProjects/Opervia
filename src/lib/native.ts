import { App } from "@capacitor/app";
import { registerPlugin } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { supabase } from "../api";
import { isNative } from "./platform";

/**
 * Repaints the strip behind the system bars. MainActivity insets the WebView to
 * keep the topbar clear of the clock, and whatever that padding is painted is
 * what shows above the app — so it has to follow the theme.
 */
interface NativeShellPlugin {
  setBackground(options: { color: string }): Promise<void>;
}
const NativeShell = registerPlugin<NativeShellPlugin>("NativeShell");

/** The page colour for each theme, matching --page in styles.css. */
const SHELL = { light: "#f7f8f5", dark: "#0e1a16" } as const;

/**
 * Everything the native shell needs that the web build does not. Called once
 * from main.tsx and returns immediately on web, so the browser bundle is
 * unaffected beyond a single boolean check.
 */
export function initNative(onRecovery: () => void) {
  if (!isNative()) return;

  // The native shell already insets the WebView below the status bar and above
  // the navigation bar (MainActivity), so the CSS safe-area padding must stand
  // down or the app pads twice.
  document.documentElement.classList.add("is-native");

  // The status bar strip is painted by MainActivity; its icons follow the theme
  // (see setNativeTheme, called from App once the theme is known).

  // Confirmation and password-reset links come back through the app scheme
  // (io.novity.opervia://auth?...). Supabase cannot see that URL itself, so the
  // PKCE code is exchanged here by hand.
  void App.addListener("appUrlOpen", async ({ url }) => {
    if (!supabase) return;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    // Params may sit in the query or, for older link formats, the fragment.
    const params = new URLSearchParams(
      parsed.search || parsed.hash.replace(/^#/, ""),
    );
    if (params.has("recovery")) onRecovery();
    const code = params.get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) console.error("[opervia] auth callback failed", error.message);
      return;
    }
    // Implicit-flow fallback: the tokens are already in the link.
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token)
      await supabase.auth.setSession({ access_token, refresh_token });
  });
}

/**
 * Android's hardware back button. Without this it closes the whole app from any
 * screen, which would throw away a half-typed invoice. `onBack` returns true
 * when it consumed the press (a dialog was open, or we left a sub-page).
 */
export function initBackButton(onBack: () => boolean) {
  if (!isNative()) return;
  void App.addListener("backButton", () => {
    if (onBack()) return;
    void App.exitApp();
  });
}

/**
 * Keeps the Android status bar legible against whichever theme is showing.
 * Style.Light means dark icons for a light background, and vice versa.
 */
export async function setNativeTheme(resolved: "light" | "dark") {
  if (!isNative()) return;
  // Dark theme means light system icons, and vice versa.
  await StatusBar.setStyle({
    style: resolved === "dark" ? Style.Dark : Style.Light,
  });
  // The strip itself. StatusBar.setBackgroundColor cannot do this on
  // targetSdk 35 — the platform ignores it once edge-to-edge is enforced — so
  // the content root is painted directly instead.
  try {
    await NativeShell.setBackground({ color: SHELL[resolved] });
  } catch {
    // Older shell without the plugin: the startup colour still applies.
  }
  try {
    await StatusBar.setBackgroundColor({ color: SHELL[resolved] });
  } catch {
    // Ignored on Android 15; harmless where it still works.
  }
}
