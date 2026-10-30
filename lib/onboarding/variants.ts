import { normalizeDomain } from "./domain";

/**
 * Name variations AI engines commonly use for a brand, suggested from what the user typed.
 * Deterministic and local — no claim that these were "found" anywhere. The user ticks the ones that apply.
 */
export function suggestVariants(name: string, domain?: string | null): string[] {
  const base = name.trim().replace(/\s+/g, " ");
  if (!base) return [];
  const out = new Set<string>();
  const withoutThe = base.replace(/^the\s+/i, "");
  if (withoutThe !== base) out.add(withoutThe);
  const words = withoutThe.split(" ").filter(Boolean);
  if (words.length > 1) {
    out.add(words.join(""));
    const initials = words.map((w) => w[0]).join("").toUpperCase();
    if (initials.length >= 2 && initials.length <= 5) out.add(initials);
  }
  const d = domain ? normalizeDomain(domain) : null;
  if (d) {
    out.add(d);
    const stem = d.split(".")[0];
    if (stem && stem.toLowerCase() !== withoutThe.replace(/\s+/g, "").toLowerCase()) out.add(stem);
  }
  out.delete(base);
  return [...out].slice(0, 6);
}
