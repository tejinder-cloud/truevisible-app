"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** While something is being worked on in the background, re-read the page every few seconds (stops after 3 minutes). */
export function AutoRefresh({ active, everyMs = 4000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const t = setInterval(() => { if (Date.now() - started > 180_000) clearInterval(t); else router.refresh(); }, everyMs);
    return () => clearInterval(t);
  }, [active, everyMs, router]);
  return null;
}
