import type { InvoiceInput } from "../domain";

// A rescue copy of the invoice being typed, held only for this browser tab.
// It exists so an expired session or a reload does not destroy work in progress;
// it is not a drafts feature and never outlives the tab or a successful save.
const DRAFT_KEY = "opervia:invoice-rescue";

export function saveRescuedDraft(input: InvoiceInput) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(input));
  } catch {
    // Private mode or a full quota. The draft is a courtesy, never a guarantee.
  }
}
export function readRescuedDraft(): InvoiceInput | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InvoiceInput;
    return parsed && Array.isArray(parsed.items) ? parsed : null;
  } catch {
    return null;
  }
}
export function hasRescuedDraft() {
  return !!readRescuedDraft();
}
export function clearRescuedDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to recover from; the draft simply stays until the tab closes.
  }
}
