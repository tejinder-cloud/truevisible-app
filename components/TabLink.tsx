"use client";
import Link, { useLinkStatus } from "next/link";

function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <span className="spinner tab-spinner" aria-label="Loading" /> : null;
}
/** A dashboard tab that shows it heard the click while the next tab loads. */
export function TabLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} prefetch>{children}<Pending /></Link>;
}
