import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspace, trialDaysLeft } from "@/lib/workspace";
import { DashboardShell } from "@/components/DashboardShell";
import { ga4Configured } from "@/lib/ga4";
import { IMPACT_LABEL, impactSummary, type Ga4Row, type VisRow } from "@/lib/impact";

export const metadata = { title: "Impact" };
const RANGES = [30, 90];
const day = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const pct = (x: { n: number; of: number } | null) => (x && x.of ? `${Math.round((x.n / x.of) * 100)}%` : "—");
const num = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 1 });

export default async function ImpactTab({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { supabase, user, brand, subscription } = await getWorkspace();
  if (!brand || brand.onboarding_step < 4) redirect(`/onboarding?step=${brand?.onboarding_step ?? 1}`);
  const days = RANGES.includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 30;
  const todayIst = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const from = new Date(Date.parse(todayIst + "T00:00:00Z") - (days - 1) * 86_400_000).toISOString().slice(0, 10);

  const [{ data: ga4 }, { data: rows }, { data: vis }] = await Promise.all([
    supabase.from("integrations").select("status, config").eq("brand_id", brand.id).eq("provider", "ga4").maybeSingle(),
    supabase.from("ga4_daily").select("date, engine, sessions, engaged_sessions, key_events").eq("brand_id", brand.id).gte("date", from).limit(5000),
    supabase.from("v_visibility_daily").select("run_date, engine, answers, mentioned").eq("brand_id", brand.id).gte("run_date", from),
  ]);
  const connected = ga4?.status === "connected";
  const s = impactSummary((rows ?? []) as Ga4Row[], (vis ?? []) as VisRow[]);

  return (
    <DashboardShell active="Impact" email={user.email} trialDays={trialDaysLeft(subscription)} brandName={brand.name} domain={brand.primary_domain}>
      <section className="stack-xs">
        <h2>Is AI sending you visitors?</h2>
        <p className="muted">Visits to your website that came from AI assistants, from your Google Analytics 4, shown next to how often AI named you.</p>
      </section>

      {!connected ? (
        <section className="card stack-s">
          <h3>{ga4?.status === "pending" ? "Pick your website's GA4 property to finish." : ga4?.status === "error" ? "Google Analytics needs reconnecting." : "Connect Google Analytics to see visits from AI."}</h3>
          <p className="muted">Read-only access. We read daily visit counts by source — never personal data — and you can disconnect any time in Settings.</p>
          <p>{ga4Configured() || ga4 ? <Link className="btn btn-primary" href="/dashboard/settings#integrations">{ga4?.status === "pending" ? "Choose property" : "Connect Google Analytics"}</Link> : <span className="muted">Google Analytics connection is coming soon.</span>}</p>
        </section>
      ) : (
        <>
          <div className="row" role="group" aria-label="Time range" style={{ gap: 8, flexWrap: "wrap" }}>
            {RANGES.map((d) => <Link key={d} href={`/dashboard/impact?days=${d}`} className={`chip filter${d === days ? " on" : ""}`}>Last {d} days</Link>)}
            <span className="small muted" style={{ alignSelf: "center" }}>{ga4?.config?.property_name}</span>
          </div>
          {!rows?.length ? (
            <section className="card stack-xs">
              <h3>No visits from AI recorded yet.</h3>
              <p className="muted">We read Google Analytics within 15 minutes of connecting, then every morning. If it stays empty, AI assistants haven&apos;t sent visits that Google Analytics could identify in this period.</p>
            </section>
          ) : (
            <>
              <section className="grid-stats">
                <div className="card stack-xs"><p className="eyebrow">Visits from AI</p><p className="stat">{num(s.visits)}</p><p className="small muted">Last {days} days</p></div>
                <div className="card stack-xs"><p className="eyebrow">Engaged visits</p><p className="stat">{num(s.engaged)}</p><p className="small muted">Stayed 10s+, or 2+ pages, or converted</p></div>
                <div className="card stack-xs"><p className="eyebrow">Key events</p><p className="stat">{num(s.keyEvents)}</p><p className="small muted">Conversions you marked in GA4</p></div>
              </section>
              <section className="card stack-s">
                <h3>By AI assistant</h3>
                <div className="table-wrap"><table className="data-table">
                  <thead><tr><th scope="col">AI</th><th scope="col">Visits</th><th scope="col">Engaged</th><th scope="col">Key events</th><th scope="col">Named you</th></tr></thead>
                  <tbody>{s.engines.map((e) => (
                    <tr key={e.engine}><td>{IMPACT_LABEL[e.engine] ?? e.engine}</td><td>{num(e.visits)}</td><td>{num(e.engaged)}</td><td>{num(e.keyEvents)}</td>
                      <td>{e.visibility ? `${pct(e.visibility)} (${e.visibility.n} of ${e.visibility.of})` : <span className="muted">not tracked</span>}</td></tr>
                  ))}</tbody>
                </table></div>
              </section>
              <section className="card stack-s">
                <h3>Week by week</h3>
                <div className="table-wrap"><table className="data-table">
                  <thead><tr><th scope="col">Week of</th><th scope="col">Visits from AI</th><th scope="col">Key events</th><th scope="col">AI named you</th></tr></thead>
                  <tbody>{s.weeks.map((w) => <tr key={w.week}><td>{day(w.week)}</td><td>{num(w.visits)}</td><td>{num(w.keyEvents)}</td><td>{pct(w.visibility)}</td></tr>)}</tbody>
                </table></div>
              </section>
            </>
          )}
          <p className="small muted">Some AI apps don&apos;t tell your website where a visitor came from, so these counts are a floor, not the full picture. Visits and visibility side by side show a trend — not proof that one caused the other.</p>
        </>
      )}
    </DashboardShell>
  );
}
