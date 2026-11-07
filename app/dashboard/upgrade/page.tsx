import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspace, trialDaysLeft, trialState } from "@/lib/workspace";
import { DashboardShell } from "@/components/DashboardShell";

export const metadata = { title: "Upgrade" };

// Two ways forward after the trial (decision 7 Nov 2026). Prices live on thegrowthlab.co.in, not in the app.
export default async function Upgrade() {
  const { supabase, user, brand, subscription } = await getWorkspace();
  if (!brand || brand.onboarding_step < 4) redirect(`/onboarding?step=${brand?.onboarding_step ?? 1}`);
  const t = trialState(subscription);
  const { data: baseline } = await supabase.from("reports").select("id, summary").eq("brand_id", brand.id).eq("kind", "baseline").order("created_at", { ascending: false }).limit(1).maybeSingle();

  return (
    <DashboardShell active="" email={user.email} trialDays={trialDaysLeft(subscription)} brandName={brand.name} domain={brand.primary_domain}>
      <section className="stack-xs">
        <p className="eyebrow">{t.kind === "ended" ? "Your trial has ended" : t.kind === "live" ? `Trial · ${t.daysLeft} ${t.daysLeft === 1 ? "day" : "days"} left` : "Plans"}</p>
        <h2>Keep watching, or have it done.</h2>
        <p className="muted">
          {t.kind === "ended" ? "Your dashboard and reports stay readable. Checks have stopped until you choose a plan." : "Choose how you want to carry on after your trial."}
          {baseline && <> Your 7-day baseline: {baseline.summary}. <Link href={`/dashboard/reports/${baseline.id}`}>Read it →</Link></>}
        </p>
      </section>
      <div className="grid-2" style={{ alignItems: "stretch" }}>
        <section className="card stack-s">
          <p className="eyebrow">Track</p>
          <h3>Keep watching</h3>
          <ul className="steps">
            <li>Up to 50 questions checked on ChatGPT, Gemini and Perplexity every week, with a deeper check each month</li>
            <li>Weekly email, monthly PDF review, and this dashboard</li>
            <li>Recommendations ranked, with ready-made drafts — you act on them</li>
            <li>Visits from AI, from your Google Analytics</li>
          </ul>
          <p style={{ marginTop: "auto" }}><a className="btn btn-primary" href="/dashboard/managed/go?plan=track" target="_blank" rel="noopener">Upgrade to Track</a></p>
        </section>
        <section className="card stack-s">
          <p className="eyebrow">Managed</p>
          <h3>Have it done</h3>
          <ul className="steps">
            <li>Everything in Track</li>
            <li>Our team carries out the recommendations — listings and mentions off your site, pages and schema on it</li>
            <li>Your Google Business Profile managed</li>
            <li>A monthly “what we changed” report, and WhatsApp alerts</li>
          </ul>
          <p style={{ marginTop: "auto" }}><a className="btn btn-secondary" href="/dashboard/managed/go?plan=managed" target="_blank" rel="noopener">See Managed</a></p>
        </section>
      </div>
      <p className="small muted">Plans and prices are on thegrowthlab.co.in. No plan guarantees a place in AI answers — we measure honestly and work on what moves them.</p>
    </DashboardShell>
  );
}
