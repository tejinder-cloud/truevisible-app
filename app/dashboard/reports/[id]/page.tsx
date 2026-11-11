import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getWorkspace, trialDaysLeft } from "@/lib/workspace";
import { DashboardShell } from "@/components/DashboardShell";
import { ENGINE_LABEL } from "@/lib/overview";

export const metadata = { title: "Report" };
type Ratio = { n: number; of: number };
const day = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const eng = (e: string) => ENGINE_LABEL[e] ?? e;
const r = (x: Ratio | null | undefined) => (x && x.of ? `${x.n} of ${x.of}` : "—");
const pct = (x: Ratio | null | undefined) => (x && x.of ? `${Math.round((x.n / x.of) * 100)}%` : "—");
function Delta({ now, prev }: { now: Ratio; prev: Ratio | null }) {
  if (!prev) return <span className="muted">first report</span>;
  const d = now.n - prev.n;
  return <span className="muted">{d === 0 ? "same as before" : `${d > 0 ? "+" : ""}${d} vs ${r(prev)}`}</span>;
}

export default async function Report({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, brand, subscription } = await getWorkspace();
  if (!brand || brand.onboarding_step < 4) redirect(`/onboarding?step=${brand?.onboarding_step ?? 1}`);
  const { id } = await params;
  const { data: rep } = await supabase.from("reports").select("id, kind, period_start, period_end, content, emailed_at, email_recipients, url").eq("id", id).eq("brand_id", brand.id).maybeSingle();
  if (!rep) notFound();
  const c = rep.content as any;

  return (
    <DashboardShell active="Reports" email={user.email} trialDays={trialDaysLeft(subscription)} brandName={brand.name} domain={brand.primary_domain}>
      <p className="small"><Link href="/dashboard/reports">← All reports</Link></p>
      <section className="stack-xs">
        <p className="eyebrow">{rep.kind === "monthly" ? "Monthly review" : rep.kind === "weekly" ? "Weekly trend" : "Daily digest"}</p>
        <h2>{rep.kind === "monthly" ? new Date(rep.period_start + "T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }) : rep.kind === "weekly" ? `${day(rep.period_start!)} – ${day(rep.period_end!)}` : day(rep.period_end!)}</h2>
        {rep.url && <p><a className="btn btn-secondary btn-s" href={`/dashboard/reports/${rep.id}/pdf`}>Download PDF</a></p>}
        <p className="small muted">{rep.emailed_at ? `Emailed to ${rep.email_recipients} ${rep.email_recipients === 1 ? "person" : "people"}` : "Not emailed (nothing changed, or email is off)"}</p>
      </section>

      <section className="grid-stats">
        <div className="card stack-xs">
          <p className="eyebrow">Answers naming you</p>
          <p className="stat">{pct(c.overall)}</p>
          <p className="small">{r(c.overall)} · <Delta now={c.overall} prev={c.prevOverall} /></p>
        </div>
        {(c.engines ?? []).map((e: any) => (
          <div key={e.engine} className="card stack-xs">
            <p className="eyebrow">{eng(e.engine)}</p>
            <p className="stat" style={{ fontSize: 36 }}>{pct(e.today ?? e.week)}</p>
            <p className="small">{r(e.today ?? e.week)}{e.prev ? <span className="muted"> · was {r(e.prev)}</span> : null}</p>
          </div>
        ))}
      </section>

      {rep.kind === "daily" ? (
        <div className="grid-2">
          <section className="card stack-s">
            <h3>What changed</h3>
            {!c.prevOverall ? <p className="muted">First digest — changes show from tomorrow.</p>
              : !c.gained?.length && !c.lost?.length ? <p className="muted">No question changed since {day(c.prevDate)} ({c.comparedPairs} answers compared).</p>
              : <>
                  {c.gained?.length > 0 && <><p className="small muted">Newly named</p><ul className="evidence">{c.gained.map((g: any, i: number) => <li key={i}>“{g.prompt}” — {eng(g.engine)}</li>)}</ul></>}
                  {c.lost?.length > 0 && <><p className="small muted">No longer named</p><ul className="evidence">{c.lost.map((g: any, i: number) => <li key={i}>“{g.prompt}” — {eng(g.engine)}</li>)}</ul></>}
                </>}
          </section>
          <section className="card stack-s">
            <h3>Competitors and sources</h3>
            {c.competitors?.length ? <ul className="evidence">{c.competitors.map((x: any) => <li key={x.name}>{x.name}: {x.today} answers{x.prev != null && x.prev !== x.today ? ` (was ${x.prev})` : ""}</li>)}</ul> : <p className="muted">No tracked competitor was named.</p>}
            <p className="small muted">New sites AI cited</p>
            <p>{c.newSites?.length ? c.newSites.join(", ") : "—"}</p>
          </section>
        </div>
      ) : (
        <div className="grid-2">
          <section className="card stack-s">
            <h3>Questions without your name</h3>
            <p>{r(c.unbranded)} answers named you {rep.kind === "weekly" && c.days === 1 ? "in this week's check" : `over ${c.days} ${c.days === 1 ? "day" : "days"}`}.</p>
            {c.strongest?.length > 0 && <><p className="small muted">Where AI names you</p><ul className="evidence">{c.strongest.map((s: any) => <li key={s.prompt}>“{s.prompt}” — {s.named} of {s.of}</li>)}</ul></>}
            {c.neverNamed?.length > 0 && <><p className="small muted">Never named this week</p><ul className="evidence">{c.neverNamed.map((q: string) => <li key={q}>“{q}”</li>)}</ul></>}
          </section>
          <section className="card stack-s">
            <h3>Competitors and sources</h3>
            {c.competitors?.length ? <ul className="evidence">{c.competitors.map((x: any) => <li key={x.name}>{x.name}: {x.answers} answers (you: {c.brandAnswers})</li>)}</ul> : <p className="muted">No tracked competitor was named.</p>}
            <p className="small muted">Sites AI read most</p>
            <p>{c.topSites?.length ? c.topSites.map((s: any) => `${s.domain} (${s.answers})`).join(", ") : "—"}</p>
          </section>
        </div>
      )}

      {rep.kind === "monthly" && (
        <div className="grid-2">
          <section className="card stack-s">
            <h3>Won and lost this month</h3>
            <p className="small muted">Questions without your name, compared with last month</p>
            {c.won?.length ? <ul className="evidence">{c.won.map((q: string) => <li key={q}>Won: “{q}”</li>)}</ul> : <p className="muted">No question newly won.</p>}
            {c.lost?.length ? <ul className="evidence">{c.lost.map((q: string) => <li key={q}>Lost: “{q}”</li>)}</ul> : <p className="muted">None lost.</p>}
          </section>
          <section className="card stack-s">
            <h3>Next month</h3>
            {c.plan?.length ? <ol className="evidence">{c.plan.map((t: string) => <li key={t}>{t}</li>)}</ol> : <p className="muted">—</p>}
            <p className="small muted">{c.recsDone ? `${c.recsDone} recommendation${c.recsDone === 1 ? "" : "s"} marked done this month.` : "No recommendation marked done this month."}</p>
          </section>
        </div>
      )}

      {c.topRec && rep.kind !== "monthly" && (
        <section className="card stack-xs">
          <p className="eyebrow">One thing to do</p>
          <h3>{c.topRec}</h3>
          <p className="small"><Link href="/dashboard/recommendations">See it with the ready-made draft →</Link>{c.kind === "weekly" && c.recsDone ? <span className="muted"> · {c.recsDone} completed this week</span> : null}</p>
        </section>
      )}
    </DashboardShell>
  );
}
