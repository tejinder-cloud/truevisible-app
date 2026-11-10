import { getWorkspace } from "@/lib/workspace";

const FIX: Record<string, string> = {
  wordpress: "In WordPress: Settings → Reading → untick “Discourage search engines from indexing this site”. If you use Rank Math or Yoast, check its Titles & Meta / Search Appearance settings too.",
  shopify: "In Shopify: remove the password page (Online Store → Preferences) and any app that adds noindex.",
  wix: "In Wix: SEO Settings → turn on “Let search engines index your site”.",
  squarespace: "In Squarespace: Settings → SEO → make sure the site isn't hidden from search engines.",
  webflow: "In Webflow: Site settings → SEO → check indexing for your live domain and page-level noindex.",
};
type Issue = { code: string; severity: string; text: string };

/** Red banner on every dashboard tab while the latest site check finds a critical problem (10 Nov 2026). */
export async function SiteHealthBanner() {
  const { supabase, brand } = await getWorkspace();
  if (!brand?.primary_domain) return null;
  const { data } = await supabase.from("site_checks").select("issues, checked_at").eq("brand_id", brand.id).order("checked_at", { ascending: false }).limit(1).maybeSingle();
  const critical = ((data?.issues ?? []) as Issue[]).filter((i) => i.severity === "critical");
  if (!critical.length) return null;
  return (
    <section className="card stack-xs site-alert" role="alert">
      <h3>{brand.primary_domain} is hidden from search engines and AI</h3>
      {critical.map((i) => <p key={i.code} className="small">{i.text}</p>)}
      <p className="small"><strong>How to fix it:</strong> {FIX[brand.site_platform ?? ""] ?? "Ask whoever manages your website to remove the noindex setting from your pages."}</p>
      <p className="small muted">Checked {new Date(data!.checked_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}. We check every few hours; this disappears once it&apos;s fixed.</p>
    </section>
  );
}
