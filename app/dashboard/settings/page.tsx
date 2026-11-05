import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspace, promptLimit, trialDaysLeft } from "@/lib/workspace";
import { DashboardShell } from "@/components/DashboardShell";
import { SubmitButton } from "@/components/SubmitButton";
import { saveEmailPrefs } from "./actions";
import { Ga4Card } from "@/components/Ga4Card";
import { ga4Configured } from "@/lib/ga4";

export const metadata = { title: "Settings" };
const LANG: Record<string, string> = { en: "English", hi: "Hindi", hinglish: "Hinglish" };
const PLATFORM: Record<string, string> = { wordpress: "WordPress", shopify: "Shopify", webflow: "Webflow", wix: "Wix", squarespace: "Squarespace", custom: "Custom", none: "No website" };
const PLAN: Record<string, string> = { trial: "Free trial", truevisible: "TrueVisible", managed_aeo: "Managed AEO", internal: "Internal (The Growth Lab)", agency: "Agency" };
const SETUP: Record<string, string> = { pending_verification: "Being checked by our team", needs_changes: "Needs a change", verified: "Verified" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="settings-row"><dt className="small muted">{label}</dt><dd>{children}</dd></div>;
}
function Soon() {
  return <span className="muted">Not connected yet · coming soon</span>;
}

export default async function SettingsTab({ searchParams }: { searchParams: Promise<{ ga4?: string }> }) {
  const { supabase, user, brand, subscription } = await getWorkspace();
  if (!brand || brand.onboarding_step < 4) redirect(`/onboarding?step=${brand?.onboarding_step ?? 1}`);
  const { ga4: flash } = await searchParams;
  const [{ data: competitors }, { count: prompts }, { data: market }, { data: me }, { data: ga4 }] = await Promise.all([
    supabase.from("competitors").select("name, domain").eq("brand_id", brand.id).eq("status", "active").order("name"),
    supabase.from("prompts").select("id", { count: "exact", head: true }).eq("brand_id", brand.id).eq("status", "active"),
    supabase.from("products_icps").select("product, icp, location").eq("brand_id", brand.id).order("created_at").limit(1).maybeSingle(),
    supabase.from("tenant_members").select("email_daily, email_weekly").eq("user_id", user.id).eq("tenant_id", brand.tenant_id).maybeSingle(),
    supabase.from("integrations").select("status, config").eq("brand_id", brand.id).eq("provider", "ga4").maybeSingle(),
  ]);
  const days = trialDaysLeft(subscription);

  return (
    <DashboardShell active="Settings" email={user.email} trialDays={days} brandName={brand.name} domain={brand.primary_domain}>
      <p className="muted">Changing your brand, competitors or questions sends your setup back to our team for a quick check. New questions are asked within a minute.</p>
      <div className="grid-2">
        <section className="card stack-s">
          <div className="spread"><h3>Brand</h3><Link href="/onboarding?step=1">Edit</Link></div>
          <dl className="settings">
            <Row label="Name">{brand.name}</Row>
            <Row label="Website">{brand.primary_domain ?? "—"}</Row>
            <Row label="Site platform">{brand.site_platform ? PLATFORM[brand.site_platform] ?? brand.site_platform : "—"}</Row>
            <Row label="Setup">{SETUP[brand.setup_status] ?? brand.setup_status}</Row>
          </dl>
        </section>
        <section className="card stack-s">
          <div className="spread"><h3>Market &amp; competitors</h3><Link href="/onboarding?step=2">Edit</Link></div>
          <dl className="settings">
            <Row label="What you sell">{(market?.product as string) || "—"}</Row>
            <Row label="Who buys">{(market?.icp as string) || "—"}</Row>
            <Row label="Where">{(market?.location as string) || "—"}</Row>
            <Row label="Competitors">{competitors?.length ? competitors.map((c) => c.name).join(", ") : <span className="muted">None yet</span>}</Row>
          </dl>
        </section>
        <section className="card stack-s">
          <div className="spread"><h3>Questions &amp; languages</h3><Link href="/onboarding?step=3">Edit</Link></div>
          <dl className="settings">
            <Row label="Active questions">{prompts ?? 0} of {promptLimit(subscription)} on your plan</Row>
            <Row label="Languages">{brand.languages.map((l) => LANG[l] ?? l).join(", ") || "—"}</Row>
            <Row label="Asked">Every day at 6:00 AM IST on ChatGPT, Gemini and Perplexity</Row>
          </dl>
          <Link href="/dashboard/prompts" className="small">See every question&apos;s answers →</Link>
        </section>
        <section className="card stack-s">
          <h3>Plan</h3>
          <dl className="settings">
            <Row label="Plan">{subscription ? PLAN[subscription.plan] ?? subscription.plan : "—"}</Row>
            {days != null && <Row label="Trial">{days} {days === 1 ? "day" : "days"} left</Row>}
            <Row label="Billing"><span className="muted">Online payment · coming soon</span></Row>
          </dl>
        </section>
        <section className="card stack-s" id="integrations">
          <h3>Integrations</h3>
          <dl className="settings">
            <Row label="Google Analytics 4"><Ga4Card ga4={ga4 as any} configured={ga4Configured()} flash={flash} /></Row>
            <Row label="WordPress"><Soon /></Row>
            <Row label="Google Business Profile"><Soon /></Row>
          </dl>
        </section>
        <section className="card stack-s" id="email">
          <h3>Email reports</h3>
          <form action={saveEmailPrefs} className="stack-s">
            <label className="row" style={{ gap: 10, alignItems: "flex-start" }}>
              <input type="checkbox" name="daily" defaultChecked={me?.email_daily ?? true} style={{ width: 20, height: 20, marginTop: 2 }} />
              <span><strong>Daily digest</strong><br /><span className="small muted">Around 8 AM, only on days something changed</span></span>
            </label>
            <label className="row" style={{ gap: 10, alignItems: "flex-start" }}>
              <input type="checkbox" name="weekly" defaultChecked={me?.email_weekly ?? true} style={{ width: 20, height: 20, marginTop: 2 }} />
              <span><strong>Weekly trend</strong><br /><span className="small muted">Monday morning, the week before</span></span>
            </label>
            <div><SubmitButton pending="Saving…" variant="secondary">Save</SubmitButton></div>
          </form>
          <p className="small muted">Every report stays in the <a href="/dashboard/reports">Reports</a> tab either way.</p>
        </section>
        <section className="card stack-s">
          <h3>Team &amp; alerts</h3>
          <dl className="settings">
            <Row label="Signed in as">{user.email}</Row>
            <Row label="Team members"><span className="muted">Invites · coming soon</span></Row>
            <Row label="Alerts"><span className="muted">WhatsApp alerts · coming soon</span></Row>
          </dl>
        </section>
      </div>
    </DashboardShell>
  );
}
