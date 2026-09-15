import { Capacitor, registerPlugin } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

/**
 * The one place that knows whether Opervia is running in a browser or inside a
 * native shell. Everything else calls these functions and stays unaware.
 *
 * Rule for this file: the web path must behave exactly as it did before
 * Capacitor existed. Native code is only ever reached when isNative() is true.
 */
export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform(); // "web" | "android" | "ios"

/**
 * Android WebView does not implement window.print(). Rather than depend on an
 * unmaintained community plugin for the feature this product exists to deliver,
 * Opervia ships its own minimal bridge to Android's PrintManager
 * (android/app/src/main/java/io/novity/opervia/PrintPlugin.java).
 * On iOS and web this is never called.
 */
interface NativePrintPlugin {
  print(options: { name: string }): Promise<{ status: PrintOutcome }>;
}
const NativePrint = registerPlugin<NativePrintPlugin>("NativePrint");

/**
 * How a print ended.
 *
 * `completed` is the only one worth celebrating, and Android is the only
 * platform that can prove it: the spooler reports the job's final state, so a
 * "saved" message there is a fact rather than a hope. A browser tells its page
 * nothing about what the print dialog did, which is why web reports `unknown`
 * and the app stays quiet instead of claiming a save it cannot see.
 */
export type PrintOutcome =
  "completed" | "cancelled" | "failed" | "unknown" | "unsupported";

/**
 * Prints the invoice currently rendered in the DOM.
 * Web: the browser's own print dialog, unchanged.
 * Android: the system print sheet, which includes "Save as PDF".
 * Returns "unsupported" when no print path exists, so the caller can say so
 * honestly instead of appearing to do nothing.
 */
export async function printDocument(
  documentName: string,
): Promise<PrintOutcome> {
  if (!isNative()) {
    window.print();
    return "unknown";
  }
  if (platform() === "android") {
    const { status } = await NativePrint.print({ name: documentName });
    return status ?? "unknown";
  }
  return "unsupported";
}

/**
 * Saves a text file and hands it to the user.
 * Web: the existing anchor download, byte for byte the same.
 * Native: written to Documents, then offered through the system share sheet,
 * because a WebView has no download manager and a[download] silently fails.
 */
export async function saveTextFile(
  filename: string,
  contents: string,
  mimeType: string,
): Promise<void> {
  if (!isNative()) {
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: contents,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });
  await Share.share({ title: filename, url: uri });
}

/**
 * Where Supabase should send confirmation and password-reset links.
 * Web: the deployed origin. Native: the app's custom scheme, which must also be
 * added to Supabase's redirect allowlist (see README).
 */
export const AUTH_SCHEME = "io.novity.opervia";
export function authRedirect(path = ""): string {
  return isNative()
    ? `${AUTH_SCHEME}://auth${path}`
    : window.location.origin + path;
}
