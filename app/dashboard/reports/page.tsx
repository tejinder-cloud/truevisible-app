import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspace, trialDaysLeft } from "@/lib/workspace";
import { DashboardShell } from "@/components/DashboardShell";

export const metadata = { title: "Reports" };
const day = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const KIND: Record<string, string> = { daily: "Daily digest", weekly: "Weekly trend", monthly: "Monthly review", audit: "Audit" };

export default async function ReportsTab({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { supabase, user, brand, subscription } = await getWorkspace();
  if (!brand || brand.onboarding_step < 4) redirect(`/onboarding?step=${brand?.onboarding_step ?? 1}`);
  const kind = (await searchParams).kind;
  let q = supabase.from("reports").select("id, kind, period_start, period_end, summary, emailed_at, created_at").eq("brand_id", brand.id).order("period_end", { ascending: false }).order("created_at", { ascending: false }).limit(60);
  if (kind === "daily" || kind === "weekly" || kind === "monthly") q = q.eq("kind", kind);
  const { data: reports } = await q;

  return (
    <DashboardShell active="Reports" email={user.email} trialDays={trialDaysLeft(subscription)} brandName={brand.name} domain={brand.primary_domain}>
      <section className="stack-s">
        <div className="stack-xs">
          <h2>Your reports</h2>
          <p className="muted">A daily digest after each morning check, a weekly trend every Monday, and a one-page monthly review (PDF) on the 1st. Each one is emailed to you as well — <Link href="/dashboard/settings">choose which</Link>.</p>
        </div>
        <div className="row" role="group" aria-label="Filter reports" style={{ gap: 8, flexWrap: "wrap" }}>
          {[{ k: undefined, l: "All" }, { k: "daily", l: "Daily" }, { k: "weekly", l: "Weekly" }, { k: "monthly", l: "Monthly" }].map((f) => (
            <Link key={f.l} href={f.k ? `/dashboard/reports?kind=${f.k}` : "/dashboard/reports"} className={`chip filter${kind === f.k ? " on" : ""}`}>{f.l}</Link>
          ))}
        </div>
      </section>
      {!reports?.length ? (
        <section className="card stack-xs">
          <h3>No reports yet.</h3>
          <p className="muted">Your first daily digest arrives the morning after your setup is checked — usually by 8 AM. The first weekly trend follows on Monday.</p>
        </section>
      ) : (
        <ul className="report-list">
          {reports.map((r) => (
            <li key={r.id}>
              <Link href={`/dashboard/reports/${r.id}`} className="card report-row">
                <span className="stack-xs" style={{ minWidth: 0 }}>
                  <span className="eyebrow">{KIND[r.kind] ?? r.kind}</span>
                  <span className="report-title">{r.kind === "monthly" && r.period_start ? new Date(r.period_start + "T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }) : r.kind === "weekly" && r.period_start ? `${day(r.period_start)} – ${day(r.period_end!)}` : day(r.period_end!)}</span>
                  {r.summary && <span className="small muted">{r.summary}</span>}
                </span>
                <span className="small muted">{r.emailed_at ? "Emailed" : "On dashboard"} →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
