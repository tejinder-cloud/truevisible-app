"use client";
import { useEffect, useState } from "react";

/** A live "0:42" counter from a start time, for work running in the background. */
export function Elapsed({ since }: { since: string }) {
  const start = new Date(since).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((now - start) / 1000));
  return <span className="elapsed" aria-label={`${s} seconds so far`}>{Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}</span>;
}
