import { RefreshCw } from "lucide-react";

export default function WriteError({
  error,
  canRetry,
  busy,
  onRetry,
  safe,
}: {
  error: string;
  canRetry: boolean;
  busy: boolean;
  onRetry: () => void;
  safe?: string;
}) {
  return (
    <div className="error" role="alert">
      <p>{error}</p>
      {canRetry && (
        <div className="error-actions">
          <button
            type="button"
            className="btn secondary"
            disabled={busy}
            onClick={onRetry}
          >
            <RefreshCw size={15} className={busy ? "spin" : ""} />
            {busy ? "Trying again…" : "Try again"}
          </button>
          {safe && <small>{safe}</small>}
        </div>
      )}
    </div>
  );
}
