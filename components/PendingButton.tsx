"use client";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

/** A submit button that answers the click at once: disabled, a "working" label and a seconds counter. */
export function PendingButton({ children, pending, className = "btn btn-secondary btn-s" }: { children: React.ReactNode; pending: string; className?: string }) {
  const { pending: busy } = useFormStatus();
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!busy) { setSecs(0); return; }
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);
  return (
    <button type="submit" className={className} disabled={busy} aria-disabled={busy} aria-live="polite">
      {busy ? <><span className="spinner" aria-hidden="true" />{pending}{secs >= 1 ? ` ${secs}s` : ""}</> : children}
    </button>
  );
}
