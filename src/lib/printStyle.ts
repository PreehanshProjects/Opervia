const KEY = "opervia:mono-print";

/**
 * Whether invoices print in black and white rather than in the brand greens.
 *
 * It is remembered rather than asked each time: a business prints on the printer
 * it owns, and whoever has a mono laser has it every day. Stored beside the
 * theme, and just as survivable — a browser that refuses storage simply gets the
 * colour sheet, which is the safe default.
 */
export function readMonoPrint(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function saveMonoPrint(mono: boolean) {
  try {
    localStorage.setItem(KEY, mono ? "1" : "0");
  } catch {
    // Private mode. The choice still holds for this session.
  }
}
