/**
 * The app's public origin, e.g. "https://truevisible-app-production.up.railway.app".
 * Tolerates NEXT_PUBLIC_SITE_URL set without "https://" or with a trailing slash — a bare host made
 * Supabase treat the sign-in redirect as a relative path (30 Oct 2026: "No API key found").
 */
export function siteUrl(fallbackOrigin?: string): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || fallbackOrigin || "").trim();
  if (!raw) return "";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `${/^(localhost|127\.)/.test(raw) ? "http" : "https"}://${raw}`;
  return withScheme.replace(/\/+$/, "");
}
