import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export default function ModalShell({
  title,
  onClose,
  children,
  wide = false,
  suspended = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  suspended?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // While another dialog is stacked above this one, it keeps its DOM (and so
  // its form state) but hands over Escape and the focus trap to the dialog on top.
  const suspendedRef = useRef(suspended);
  suspendedRef.current = suspended;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const first = ref.current?.querySelector<HTMLElement>(
      "input,select,textarea,button:not(.icon-button)",
    );
    first?.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function key(e: KeyboardEvent) {
      if (suspendedRef.current) return;
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const elements = [
          ...ref.current!.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
          ),
        ];
        const first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      prev?.focus();
    };
  }, []);
  return (
    <div className={`modal-backdrop ${suspended ? "modal-suspended" : ""}`}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        inert={suspended}
        className={`modal ${wide ? "modal-wide" : ""}`}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
