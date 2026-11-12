import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspace, promptLimit, trialDaysLeft } from "@/lib/workspace";
import { DashboardShell } from "@/components/DashboardShell";
import { SubmitButton } from "@/components/SubmitButton";
import { requestErasure, saveEmailPrefs } from "./actions";
import { cancelTrack } from "../upgrade/actions";
import { formatMoney } from "@/lib/billing";
import { Ga4Card } from "@/components/Ga4Card";
import { ga4Configured } from "@/lib/ga4";
import { WordPressCard } from "@/components/WordPressCard";
import { pathFor } from "@/lib/execution";

export const metadata = { title: "Settings" };
const LANG: Record<string, string> = { en: "English", hi: "Hindi", hinglish: "Hinglish" };
const PLATFORM: Record<string, string> = { wordpress: "WordPress", shopify: "Shopify", webflow: "Webflow", wix: "Wix", squarespace: "Squarespace", custom: "Custom", none: "No website" };
const PLAN: Record<string, string> = { trial: "Free trial", track: "Track", managed: "Managed", managed_plus: "Managed Plus", truevisible: "Track", managed_aeo: "Managed", internal: "Internal (The Growth Lab)", agency: "Agency" };
const CADENCE: Record<string, string> = { internal: "Every day at 6:00 AM IST", trial: "Every day during your 7-day trial", track: "Every Monday, plus a deeper check on the 1st", managed: "Every Monday, plus a deeper check on the 1st", managed_plus: "Every Monday, plus a deeper check on the 1st", truevisible: "Every Monday, plus a deeper check on the 1st", managed_aeo: "Every Monday, plus a deeper check on the 1st" };
const SETUP: Record<string, string> = { pending_verification: "Being checked by our team", needs_changes: "Needs a change", verified: "Verified" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="settings-row"><dt className="small muted">{label}</dt><dd>{children}</dd></div>;
}
function Soon() {
  return <span className="muted">Not connected yet · coming soon</span>;
}

export default async function SettingsTab({ searchParams }: { searchParams: Promise<{ ga4?: string; upgraded?: string; wp?: string; email?: string; erase?: string }> }) {
  const { supabase, user, brand, subscription } = await getWorkspace();
  if (!brand || brand.onboarding_step < 4) redirect(`/onboarding?step=${brand?.onboarding_step ?? 1}`);
  const { ga4: flash, upgraded, wp: wpFlash, email: emailFlash, erase } = await searchParams;
  const { data: openErasure } = await supabase.from("data_requests").select("created_at").eq("status", "received").limit(1).maybeSingle();
  const [{ data: bill }, { data: invoices }] = await Promise.all([
    supabase.from("subscriptions").select("status, price_minor, currency, billing_interval, current_period_end, razorpay_subscription_id").eq("tenant_id", brand.tenant_id).eq("product", "truevisible").is("brand_id", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("invoices").select("id, number, pdf_url, amount_minor, gst_minor, currency, paid_at, created_at").eq("tenant_id", brand.tenant_id).order("created_at", { ascending: false }).limit(12),
  ]);
  const [{ data: competitors }, { count: prompts }, { data: market }, { data: me }, { data: ga4 }, { data: wp }] = await Promise.all([
    supabase.from("competitors").select("name, domain").eq("brand_id", brand.id).eq("status", "active").order("name"),
    supabase.from("prompts").select("id", { count: "exact", head: true }).eq("brand_id", brand.id).eq("status", "active"),
    supabase.from("products_icps").select("product, icp, location").eq("brand_id", brand.id).order("created_at").limit(1).maybeSingle(),
    supabase.from("tenant_members").select("email_daily, email_weekly, email_tips").eq("user_id", user.id).eq("tenant_id", brand.tenant_id).maybeSingle(),
    supabase.from("integrations").select("status, config").eq("brand_id", brand.id).eq("provider", "ga4").maybeSingle(),
    supabase.from("integrations").select("status, config").eq("brand_id", brand.id).eq("provider", "wordpress").neq("status", "revoked").maybeSingle(),
  ]);
  const path = pathFor(brand.site_platform);
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
            <Row label="Active questions">{prompts ?? 0} of {promptLimit(subscription)} on your plan{(prompts ?? 0) >= promptLimit(subscription) && promptLimit(subscription) >= 50 ? <> · <a href="/dashboard/managed/go?plan=more_questions" target="_blank" rel="noopener">need more? Ask us</a></> : null}</Row>
            <Row label="Languages">{brand.languages.map((l) => LANG[l] ?? l).join(", ") || "—"}</Row>
            <Row label="Asked">{CADENCE[subscription?.plan ?? ""] ?? "—"} · ChatGPT, Gemini and Perplexity</Row>
          </dl>
          <Link href="/dashboard/prompts" className="small">See every question&apos;s answers →</Link>
        </section>
        <section className="card stack-s" id="plan">
          <h3>Plan</h3>
          {upgraded && subscription?.plan !== "internal" && subscription?.plan !== "trial" && <p className="small" role="status"><strong>Payment received — you&apos;re on Track.</strong> Your questions are now checked every Monday.</p>}
          <dl className="settings">
            <Row label="Plan">{subscription ? PLAN[subscription.plan] ?? subscription.plan : "—"}</Row>
            {subscription?.plan === "trial" && <Row label="Trial">{days == null ? "7 days — starts after our team checks your setup and your first check runs" : days > 0 ? `${days} ${days === 1 ? "day" : "days"} left` : "Ended"}</Row>}
            {subscription?.plan === "trial" && <Row label="Next"><a href="/dashboard/upgrade">Keep watching, or have it done →</a></Row>}
            {bill && bill.razorpay_subscription_id ? (
              <>
                <Row label="Billing">{formatMoney(bill.price_minor, bill.currency)} {bill.billing_interval === "year" ? "a year" : "a month"}{bill.currency === "INR" ? " + GST" : ""}</Row>
                <Row label={bill.status === "cancelled" ? "Ends" : "Renews"}>{bill.current_period_end ? new Date(bill.current_period_end).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—"}</Row>
                {bill.status === "past_due" && <Row label="Payment"><span style={{ color: "var(--coral-dark)" }}>Last renewal failed — Razorpay will retry; update your card from their email.</span></Row>}
              </>
            ) : subscription?.plan === "trial" ? <Row label="Billing"><a href="/dashboard/upgrade/track">Upgrade to Track →</a></Row> : null}
          </dl>
          {invoices && invoices.length > 0 && (
            <div className="stack-xs">
              <p className="small muted">Payments</p>
              <ul className="evidence small">{invoices.map((i) => <li key={i.id}>{new Date(i.paid_at ?? i.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })} · {formatMoney(Number(i.amount_minor) + Number(i.gst_minor), i.currency)}{Number(i.gst_minor) ? ` (incl. GST ${formatMoney(Number(i.gst_minor), i.currency)})` : ""}{(i as any).pdf_url ? <> · <a href={`/dashboard/invoices/${i.id}/pdf`}>Tax invoice {(i as any).number}</a></> : <span className="muted"> · invoice being prepared</span>}</li>)}</ul>
            </div>
          )}
          {bill?.razorpay_subscription_id && bill.status === "active" && (
            <form action={cancelTrack}><SubmitButton pending="Cancelling…" variant="secondary">Cancel at end of period</SubmitButton></form>
          )}
        </section>
        <section className="card stack-s" id="email">
          <h3>Email reports</h3>
          <form action={saveEmailPrefs} className="stack-s">
            <label className="row" style={{ gap: 10, alignItems: "flex-start", flexWrap: "nowrap" }}>
              <input type="checkbox" name="daily" defaultChecked={me?.email_daily ?? true} style={{ width: 20, height: 20, marginTop: 2 }} />
              <span><strong>Daily digest</strong><br /><span className="small muted">Around 8 AM, only on days something changed</span></span>
            </label>
            <label className="row" style={{ gap: 10, alignItems: "flex-start", flexWrap: "nowrap" }}>
              <input type="checkbox" name="weekly" defaultChecked={me?.email_weekly ?? true} style={{ width: 20, height: 20, marginTop: 2 }} />
              <span><strong>Weekly trend</strong><br /><span className="small muted">Monday morning, the week before</span></span>
            </label>
            <label className="row" style={{ gap: 10, alignItems: "flex-start", flexWrap: "nowrap" }}>
              <input type="checkbox" name="tips" defaultChecked={(me as any)?.email_tips ?? true} style={{ width: 20, height: 20, marginTop: 2 }} />
              <span><strong>Tips and reminders</strong><br /><span className="small muted">A few short emails: finishing setup, your trial, and what changed while you were away</span></span>
            </label>
            <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <SubmitButton pending="Saving…" variant="secondary">Save</SubmitButton>
              {emailFlash === "saved" && <span className="small" role="status" style={{ color: "#2E7D4F" }}>✓ Saved — your email choices are updated.</span>}
              {emailFlash === "error" && <span className="small" role="alert" style={{ color: "var(--coral-dark)" }}>Couldn&apos;t save — please try again.</span>}
            </div>
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
      <section className="card stack-s" id="data">
        <h3>Your data</h3>
        <p className="small muted">Under India&apos;s data protection law (DPDP Act) you can see, correct and delete your personal data. Most details you can correct above. <a href="/legal/privacy">Privacy Notice</a></p>
        <p><a className="btn btn-secondary btn-s" href="/dashboard/data/export">Download your data (JSON)</a></p>
        {openErasure ? (
          <p className="small" role="status">Deletion requested on {new Date(openErasure.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}. We complete it within 30 days and email you when it&apos;s done.</p>
        ) : (
          <details className="small">
            <summary>Delete your account and data</summary>
            <form action={requestErasure} className="stack-xs" style={{ marginTop: 8, maxWidth: 420 }}>
              <p>This closes your workspace and deletes your brand, questions, answers and reports within 30 days. Invoices are kept for 8 years because GST law requires it. Cancel a paid plan first in Plan.</p>
              <label className="stack-xs"><span>Why are you leaving? (optional)</span><input name="reason" type="text" maxLength={500} /></label>
              <label className="stack-xs"><span>Type DELETE to confirm</span><input name="confirm" type="text" required autoComplete="off" /></label>
              <div><SubmitButton pending="Sending…" variant="secondary">Request deletion</SubmitButton></div>
              {erase === "confirm" && <p role="alert" style={{ color: "var(--coral-dark)" }}>Type DELETE to confirm.</p>}
              {erase === "error" && <p role="alert" style={{ color: "var(--coral-dark)" }}>Couldn&apos;t send the request — please try again or write to us.</p>}
            </form>
          </details>
        )}
        {erase === "sent" && <p className="small" role="status" style={{ color: "#2E7D4F" }}>✓ Request received.</p>}
      </section>
      <section className="card stack-m" id="integrations">
        <div className="stack-xs">
          <h3>Integrations</h3>
          <p className="small"><strong>How changes reach your site</strong> · {path.label}</p>
          <p className="small muted" style={{ maxWidth: 720 }}>{path.how}</p>
        </div>
        <div className="grid-2 integrations">
          <div className="stack-xs"><h4>Google Analytics 4</h4><Ga4Card ga4={ga4 as any} configured={ga4Configured()} flash={flash} brandName={brand.name} domain={brand.primary_domain} /></div>
          {path.connect === "wordpress" || wp ? <div className="stack-xs"><h4>WordPress</h4><WordPressCard wp={wp as any} flash={wpFlash} /></div> : null}
          <div className="stack-xs"><h4>Google Business Profile</h4><Soon /></div>
        </div>
      </section>
    </DashboardShell>
  );
}
