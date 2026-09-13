import { useEffect, useRef, useState } from "react";

/**
 * Runs an async query whenever its key changes, and keeps the previous rows on
 * screen while the next page loads — a list that blanks on every keystroke reads
 * as broken even when it is fast.
 *
 * Out-of-order responses are discarded, so a slow first request can never
 * overwrite the results of a later one.
 */
export function useQuery<T>(
  run: () => Promise<T>,
  key: string,
  enabled = true,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const mine = ++generation.current;
    setLoading(true);
    runRef
      .current()
      .then((next) => {
        if (mine !== generation.current) return;
        setData(next);
        setError("");
      })
      .catch((e: unknown) => {
        if (mine !== generation.current) return;
        setError(e instanceof Error ? e.message : "Could not load this view.");
      })
      .finally(() => {
        if (mine === generation.current) setLoading(false);
      });
  }, [key, enabled]);

  /** Re-runs the current query, e.g. after a write. */
  const reload = () => {
    if (!enabled) return;
    const mine = ++generation.current;
    setLoading(true);
    runRef
      .current()
      .then((next) => {
        if (mine === generation.current) setData(next);
      })
      .catch(() => {})
      .finally(() => {
        if (mine === generation.current) setLoading(false);
      });
  };

  return { data, loading, error, reload };
}

/** Delays a fast-changing value, so typing does not fire a query per keystroke. */
export function useDebounced<T>(value: T, ms = 300) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
