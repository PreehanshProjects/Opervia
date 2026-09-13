import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { supabase } from "../api";
import { isNative } from "./platform";

/**
 * Everything the native shell needs that the web build does not. Called once
 * from main.tsx and returns immediately on web, so the browser bundle is
 * unaffected beyond a single boolean check.
 */
export function initNative(onRecovery: () => void) {
  if (!isNative()) return;

  // The topbar is paper-white, so the status bar text must be dark.
  void StatusBar.setStyle({ style: Style.Light });

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
