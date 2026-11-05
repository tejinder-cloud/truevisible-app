import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site";
import { emailFromIdToken, parseAccountSummaries } from "@/lib/ga4";

// Google → here with ?code. Exchange it, list the account's GA4 properties, and hand the refresh token to the
// database (Vault) through tv_ga4_save_token. The customer then picks the property in Settings.
export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/dashboard/settings?ga4=${q}#integrations`, req.url));
  const p = req.nextUrl.searchParams;
  const state = req.cookies.get("tv_ga4_state")?.value;
  if (p.get("error")) return back("cancelled");
  if (!state || state !== p.get("state") || !p.get("code")) return back("expired");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const { data: member } = await supabase.from("tenant_members").select("tenant_id").eq("user_id", user.id).order("created_at").limit(1).maybeSingle();
  const { data: brand } = member ? await supabase.from("brands").select("id").eq("tenant_id", member.tenant_id).order("created_at").limit(1).maybeSingle() : { data: null };
  if (!brand) return back("failed");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code: p.get("code")!, client_id: process.env.GOOGLE_CLIENT_ID!.trim(), client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      redirect_uri: `${siteUrl(req.nextUrl.origin)}/dashboard/integrations/ga4/callback`, grant_type: "authorization_code" }),
  });
  const tok = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tok.refresh_token || !tok.access_token) return back("failed");

  const sumRes = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200", { headers: { authorization: `Bearer ${tok.access_token}` } });
  const properties = sumRes.ok ? parseAccountSummaries(await sumRes.json()) : [];
  const { error } = await supabase.rpc("tv_ga4_save_token", { p_brand: brand.id, p_refresh: tok.refresh_token, p_email: emailFromIdToken(tok.id_token) ?? "", p_properties: properties });
  if (error) return back("failed");
  const res = back(properties.length ? "pick" : "noproperties");
  res.cookies.delete({ name: "tv_ga4_state", path: "/dashboard/integrations/ga4" });
  return res;
}
