import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Paging that states the truth: "21–40 of 312", not just a page number. The
 * total comes from the server count, so it is the real size of the filtered set
 * rather than the number of rows currently on screen.
 */
export default function Pager({
  total,
  limit,
  offset,
  onOffset,
  noun = "records",
}: {
  total: number;
  limit: number;
  offset: number;
  onOffset: (next: number) => void;
  noun?: string;
}) {
  if (total <= limit) return null;
  const first = offset + 1;
  const last = Math.min(offset + limit, total);
  const atStart = offset === 0;
  const atEnd = last >= total;
  return (
    <div className="pager">
      <span className="pager-count">
        <b>
          {first}–{last}
        </b>{" "}
        of {total.toLocaleString("en-MU")} {noun}
      </span>
      <div className="pager-controls">
        <button
          type="button"
          className="btn secondary"
          disabled={atStart}
          onClick={() => onOffset(Math.max(offset - limit, 0))}
        >
          <ChevronLeft size={16} />
          Previous
        </button>
        <button
          type="button"
          className="btn secondary"
          disabled={atEnd}
          onClick={() => onOffset(offset + limit)}
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
