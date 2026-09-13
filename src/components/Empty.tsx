import { FileText } from "lucide-react";
import type { ReactNode } from "react";

export default function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <FileText size={32} />
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
