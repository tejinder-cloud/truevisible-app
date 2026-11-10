import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspace, trialDaysLeft } from "@/lib/workspace";
import { DashboardShell } from "@/components/DashboardShell";
import { canPublish } from "@/lib/execution";
import { itemState, KIND_LABEL, PATH_LABEL, planWeek, STATE_LABEL, type PlanItem } from "@/lib/aeo-plan";

export const metadata = { title: "90-day plan" };
const day = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
type Plan = { id: string; tier: string; starts_on: string; ends_on: string; scope: any; baseline: any; summary: string; months: { month: number; theme: string; focus: string }[]; items: PlanItem[] };

export default async function PlanTab() {
  const { supabase, user, brand, subscription } = await getWorkspace();
  if (!brand || brand.onboarding_step < 4) redirect(`/onboarding?step=${brand?.onboarding_step ?? 1}`);
  const managed = canPublish(subscription?.plan);
  const { data: planRow } = await supabase.from("aeo_plans")
    .select("id, tier, starts_on, ends_on, scope, baseline, summary, months, items").eq("brand_id", brand.id).eq("status", "approved")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const plan = planRow as Plan | null;

  const shell = (children: React.ReactNode) => (
    <DashboardShell active="Plan" email={user.email} trialDays={trialDaysLeft(subscription)} brandName={brand.name} domain={brand.primary_domain}>{children}</DashboardShell>
  );

  if (!plan) {
    return shell(
      <section className="card stack-s">
        {managed ? (
          <>
            <h2>Your 90-day plan is being prepared</h2>
            <p className="muted">We build it from your first AI answers and the gaps they show. {brand.setup_status === "verified" ? "It arrives within 48 hours — we'll email you when it's ready." : "It starts once your setup is checked."}</p>
          </>
        ) : (
          <>
            <h2>A 90-day plan, done for you</h2>
            <p className="muted">With managed AEO our team turns your recommendations into a week-by-week plan, publishes the pages, gets you listed on the sites AI cites, and shows every change here.</p>
            <p><a className="btn btn-primary" href="/dashboard/managed/go?from=plan" target="_blank" rel="noopener">See managed AEO</a></p>
          </>
        )}
      </section>,
    );
  }

  const todayIst = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const week = planWeek(plan.starts_on, todayIst);
  const recIds = plan.items.map((i) => i.recommendation_id).filter(Boolean) as string[];
  const [{ data: recs }, { data: acts }] = await Promise.all([
    recIds.length ? supabase.from("recommendations").select("id, status").in("id", recIds) : Promise.resolve({ data: [] as any[] }),
    recIds.length ? supabase.from("actions").select("recommendation_id, status").eq("path", "wordpress").in("recommendation_id", recIds).in("status", ["planned", "in_progress"]) : Promise.resolve({ data: [] as any[] }),
  ]);
  const recStatus = new Map(((recs ?? []) as any[]).map((r) => [r.id, r.status]));
  const busy = new Set(((acts ?? []) as any[]).map((a) => a.recommendation_id));
  const states = plan.items.map((i) => itemState(i, week, recStatus, busy));
  const done = states.filter((s) => s === "done").length;
  const b = plan.baseline ?? {};

  return shell(
    <>
      <section className="stack-xs">
        <h2>Your 90-day plan</h2>
        <p className="muted">{day(plan.starts_on)} – {day(plan.ends_on)} · {week === 0 ? "starts soon" : week > 13 ? "finished" : `week ${week} of 13`} · {done} of {plan.items.length} done</p>
      </section>

      <div className="grid-2">
        <section className="card stack-xs">
          <h3>Where we started</h3>
          <p>Named in <strong>{b.named ?? "—"}</strong> of {b.answers ?? "—"} AI answers</p>
          <p className="small muted">Measured {b.from ? day(b.from) : "—"} – {b.to ? day(b.to) : "—"}. Your own site was cited in {b.own_site_cited ?? "—"} answers.{b.competitors_named_most?.length ? ` Named most instead: ${b.competitors_named_most.map((c: any) => c.name).join(", ")}.` : ""}</p>
          <p className="small"><Link href="/dashboard">See where you are now →</Link></p>
        </section>
        <section className="card stack-xs">
          <h3>What's included each month</h3>
          <p className="small">{plan.scope.pages_per_month} new or improved pages · {plan.scope.outreach_per_month} listings or outreach · {plan.scope.gbp_profiles === 1 ? "your Google Business Profile" : `up to ${plan.scope.gbp_profiles} Google Business Profiles`} · {plan.scope.prompts_in_scope} questions tracked</p>
          <p className="small muted">No one can guarantee what AI says. We do the work and measure the answers every week.</p>
        </section>
        <section className="card stack-xs">
          <h3>The plan in short</h3>
          <p className="small">{plan.summary}</p>
        </section>
      </div>

      {plan.months.map((m) => {
        const weeks = plan.items.map((i, n) => ({ i, s: states[n] })).filter(({ i }) => (m.month === 1 ? i.week <= 4 : m.month === 2 ? i.week >= 5 && i.week <= 8 : i.week >= 9));
        return (
          <section key={m.month} className="card stack-s">
            <div className="stack-xs">
              <p className="eyebrow">Month {m.month}</p>
              <h3>{m.theme}</h3>
              <p className="small muted">{m.focus}</p>
            </div>
            <div className="table-wrap"><table className="data-table small">
              <thead><tr><th>Week</th><th>What</th><th>Where</th><th>Status</th></tr></thead>
              <tbody>{weeks.map(({ i, s }) => (
                <tr key={i.id} className={s === "this_week" ? "row-current" : undefined}>
                  <td>{i.week}</td>
                  <td><strong>{i.title}</strong>{i.count > 1 ? <span className="muted"> ×{i.count}</span> : null}<br /><span className="muted">{i.detail}</span>{i.recommendation_id ? <> · <Link href="/dashboard/recommendations">see it</Link></> : null}</td>
                  <td>{KIND_LABEL[i.kind] ?? i.kind}<br /><span className="muted">{PATH_LABEL[i.path] ?? i.path}</span></td>
                  <td><span className={`chip state-${s}`}>{STATE_LABEL[s]}</span></td>
                </tr>
              ))}</tbody>
            </table></div>
          </section>
        );
      })}
    </>,
  );
}
