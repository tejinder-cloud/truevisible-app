import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspace, trialDaysLeft } from "@/lib/workspace";
import { DashboardShell } from "@/components/DashboardShell";
import { SubmitButton } from "@/components/SubmitButton";
import { requestManagedAeo } from "../recommendations/actions";

export const metadata = { title: "Managed AEO" };

export default async function Managed({ searchParams }: { searchParams: Promise<{ from?: string; sent?: string; error?: string }> }) {
  const { supabase, user, brand, subscription } = await getWorkspace();
  if (!brand || brand.onboarding_step < 4) redirect(`/onboarding?step=${brand?.onboarding_step ?? 1}`);
  const { from, sent, error } = await searchParams;
  const [{ data: req }, { data: rec }] = await Promise.all([
    supabase.from("managed_aeo_requests").select("status, created_at").eq("brand_id", brand.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    from ? supabase.from("recommendations").select("id, title").eq("id", from).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const pending = req?.status === "new" || req?.status === "contacted";

  return (
    <DashboardShell active="Recommendations" email={user.email} trialDays={trialDaysLeft(subscription)} brandName={brand.name} domain={brand.primary_domain}>
      <p className="small"><Link href="/dashboard/recommendations">← Recommendations</Link></p>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="stack-m">
          <div className="stack-xs">
            <p className="eyebrow">Managed AEO</p>
            <h2>We do the work. You watch AI start naming you.</h2>
          </div>
          <ul className="steps">
            <li><strong>A 90-day plan within 48 hours</strong> — which questions to win first, which pages to write, which sites to get onto.</li>
            <li><strong>Weekly implementation</strong> — pages, FAQs and schema on your site, listings and mentions off it. WordPress sites we update directly; other sites get a ready-to-paste change pack.</li>
            <li><strong>Measured daily</strong> — the same tracker you see here shows whether each change moves your answers.</li>
            <li><strong>A monthly review</strong> — what we did, what moved, what&apos;s next.</li>
          </ul>
          <p><strong>₹9,999/month + GST</strong>, plus your TrueVisible plan. No per-fix pricing. Cancel any time after the first 90 days.</p>
          <p className="small muted">Scope — questions covered, pages per month, outreach volume — is written into your plan before you pay anything.</p>
        </section>

        <section className="card stack-s">
          {sent || pending ? (
            <>
              <p className="eyebrow">Request received</p>
              <h3>Thanks — our team will be in touch.</h3>
              <p className="muted">We&apos;ll contact you at {user.email} to agree your 90-day plan and scope. Nothing is charged until you&apos;ve seen and accepted it.</p>
              {req?.created_at && <p className="small muted">Requested {new Date(req.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>}
              <Link className="btn btn-secondary" href="/dashboard/recommendations">Back to recommendations</Link>
            </>
          ) : (
            <form action={requestManagedAeo} className="stack-s">
              <h3>Start managed AEO</h3>
              {rec && <p className="small muted">Starting from: “{rec.title}”</p>}
              <input type="hidden" name="recommendation" value={rec?.id ?? ""} />
              <label className="stack-xs">
                <span className="small">Anything we should know? <span className="muted">(optional)</span></span>
                <textarea name="note" rows={4} maxLength={1000} placeholder="e.g. best time to call, which service matters most, a launch date" />
              </label>
              {error && <p className="small" role="alert" style={{ color: "var(--coral-dark)" }}>That didn&apos;t go through. Please try again.</p>}
              <SubmitButton pending="Sending…">Request managed AEO</SubmitButton>
              <p className="small muted">This sends a request to our team — no payment now. We&apos;ll reply at {user.email}.</p>
            </form>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
