import { useState, type FormEvent, type ReactNode } from "react";
import ModalShell from "./ModalShell";

/**
 * The single confirmation surface for destructive and irreversible actions.
 *
 * Opervia's record is append-only, so the few actions that cannot be undone
 * deserve more than a native window.confirm: they name the record, state the
 * consequence, and — when `confirmPhrase` is set — require the user to type it
 * back. Typing is friction on purpose; it is the difference between a tap and a
 * decision.
 */
export default function ConfirmDialog({
  title,
  intro,
  detail,
  confirmPhrase,
  confirmLabel,
  cancelLabel = "Keep it",
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  intro: ReactNode;
  detail?: ReactNode;
  /** When set, the action stays disabled until the user types this exactly. */
  confirmPhrase?: string;
  confirmLabel: string;
  /** Defaults to "Keep it", which reads oddly outside a deletion. */
  cancelLabel?: string;
  busy: boolean;
  error?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matches =
    !confirmPhrase || typed.trim() === confirmPhrase.trim();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (matches && !busy) onConfirm();
  }

  return (
    <ModalShell title={title} onClose={onCancel}>
      <form className="form-body confirm-body" onSubmit={submit}>
        <p className="confirm-intro">{intro}</p>
        {detail && <div className="confirm-detail">{detail}</div>}
        {confirmPhrase && (
          <label>
            {/* One text node, or the column flex puts each fragment on its own line. */}
            <span className="confirm-prompt">
              Type <b>{confirmPhrase}</b> to confirm
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmPhrase}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-describedby="confirm-hint"
            />
          </label>
        )}
        {confirmPhrase && (
          <small id="confirm-hint" className="confirm-hint">
            {matches
              ? "That matches. This cannot be undone."
              : "The name must match exactly."}
          </small>
        )}
        {error}
        <div className="form-footer confirm-footer">
          <button
            type="button"
            className="btn secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            className="btn danger"
            disabled={busy || !matches}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
