/** Turns "https://www.Example.co.in/about?x=1" into "example.co.in". Returns null if it isn't a plausible domain. */
export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z]+:\/\//, "");
  s = s.split(/[/?#]/)[0];
  s = s.replace(/:\d+$/, "");
  s = s.replace(/^www\./, "");
  s = s.replace(/\.$/, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(s) ? s : null;
}

/** Splits a textarea / comma list into unique, trimmed, non-empty lines. */
export function splitList(input: string | null | undefined, max = 20): string[] {
  if (!input) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[\n,]/)) {
    const v = raw.trim().replace(/\s+/g, " ");
    const k = v.toLowerCase();
    if (v && !seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
    if (out.length >= max) break;
  }
  return out;
}
