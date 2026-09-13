import { Monitor, Moon, Sun } from "lucide-react";
import type { Theme } from "../lib/theme";

const OPTIONS = [
  { value: "light" as const, icon: Sun, label: "Light" },
  { value: "system" as const, icon: Monitor, label: "Match device" },
  { value: "dark" as const, icon: Moon, label: "Dark" },
];

/**
 * Three states, not two: a toggle cannot express "follow my device", and on a
 * phone that is the setting most people actually want. The thumb slides between
 * positions so the control reads as one object rather than three buttons.
 */
export default function ThemeSwitch({
  theme,
  onChange,
  compact = false,
}: {
  theme: Theme;
  onChange: (t: Theme) => void;
  compact?: boolean;
}) {
  const index = OPTIONS.findIndex((o) => o.value === theme);
  return (
    <div
      className={`theme-switch ${compact ? "compact" : ""}`}
      role="radiogroup"
      aria-label="Colour theme"
    >
      <span
        className="theme-thumb"
        style={{ transform: `translateX(${index * 100}%)` }}
        aria-hidden="true"
      />
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          aria-label={o.label}
          title={o.label}
          className={theme === o.value ? "active" : ""}
          onClick={() => onChange(o.value)}
        >
          <o.icon size={16} strokeWidth={theme === o.value ? 2.2 : 1.9} />
          {!compact && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}
