import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspace, trialDaysLeft } from "@/lib/workspace";
import { DashboardShell } from "@/components/DashboardShell";
import { TrackCheckout } from "@/components/TrackCheckout";
import { razorpayConfigured } from "@/lib/billing";

export const metadata = { title: "Upgrade to Track" };

export default async function UpgradeTrack() {
  const { user, brand, subscription } = await getWorkspace();
  if (!brand || brand.onboarding_step < 4) redirect(`/onboarding?step=${brand?.onboarding_step ?? 1}`);
  const already = subscription && ["track", "managed", "managed_plus", "internal"].includes(subscription.plan) && ["active", "past_due"].includes(subscription.status);
  return (
    <DashboardShell active="" email={user.email} trialDays={trialDaysLeft(subscription)} brandName={brand.name} domain={brand.primary_domain}>
      <p className="small"><Link href="/dashboard/upgrade">← Plans</Link></p>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="stack-s">
          <p className="eyebrow">Track</p>
          <h2>Keep watching every week.</h2>
          <ul className="steps">
            <li>Up to 50 questions on ChatGPT, Gemini and Perplexity — checked every Monday, with a deeper check on the 1st</li>
            <li>Weekly email, monthly one-page PDF review, and this dashboard</li>
            <li>Recommendations ranked, each with a ready-made draft</li>
            <li>Visits from AI, from your Google Analytics</li>
            <li>Email alerts and email support (2 business days)</li>
          </ul>
          <p className="small muted">No plan guarantees a place in AI answers.</p>
        </section>
        <section className="card stack-s">
          {already ? <p>You&apos;re already on a paid plan. <Link href="/dashboard/settings#plan">See your plan →</Link></p>
            : razorpayConfigured() ? <TrackCheckout />
            : <p className="muted">Online payment is being switched on. <a href="/dashboard/managed/go?plan=track" target="_blank" rel="noopener">Tell us you want Track</a> and we&apos;ll set it up.</p>}
        </section>
      </div>
    </DashboardShell>
  );
}
