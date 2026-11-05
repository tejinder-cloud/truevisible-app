// Google Analytics 4 connection (plan Day 24). Read-only scope; the refresh token goes straight to Supabase Vault.

export const GA4_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/analytics.readonly"];

export function ga4Configured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function ga4AuthUrl(redirectUri: string, state: string): string {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!.trim());
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", GA4_SCOPES.join(" "));
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");          // always return a refresh token
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", state);
  return u.toString();
}

export type Ga4Property = { id: string; name: string; account: string };

/** accountSummaries → flat list of GA4 properties (pure; tested). */
export function parseAccountSummaries(json: any): Ga4Property[] {
  const out: Ga4Property[] = [];
  for (const a of json?.accountSummaries ?? [])
    for (const p of a?.propertySummaries ?? [])
      if (typeof p?.property === "string" && p.property.startsWith("properties/"))
        out.push({ id: p.property, name: String(p.displayName ?? p.property), account: String(a.displayName ?? "") });
  return out.slice(0, 200);
}

/** The email in a Google id_token (payload only; the token came straight from Google over TLS). */
export function emailFromIdToken(idToken: string | undefined): string | null {
  try { return JSON.parse(Buffer.from(String(idToken).split(".")[1], "base64url").toString()).email ?? null; } catch { return null; }
}
