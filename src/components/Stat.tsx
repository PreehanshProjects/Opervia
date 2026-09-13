import type { ReactNode } from "react";

export default function Stat({
  title,
  value,
  hint,
  icon,
  featured = false,
}: {
  title: string;
  value: string;
  hint: string;
  icon: ReactNode;
  featured?: boolean;
}) {
  return (
    <div className={`stat-card ${featured ? "featured" : ""}`}>
      <div>
        <span>{title}</span>
        <i>{icon}</i>
      </div>
      <strong>{value}</strong>
      <p>{hint}</p>
    </div>
  );
}
