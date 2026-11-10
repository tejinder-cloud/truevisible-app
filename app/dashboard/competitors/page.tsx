import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspace, trialDaysLeft } from "@/lib/workspace";
import { DashboardShell } from "@/components/DashboardShell";
import { PendingButton } from "@/components/PendingButton";
import { refLabel, winsChange, type Playbook, type Rival } from "@/lib/competitors";
import { trackCompetitor } from "./actions";

export const metadata = { title: "Competitors" };
const day = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const ENGINE: Record<string, string> = { chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity", ai_overviews: "AI Overviews", copilot: "Copilot" };
type Report = { id: string; period_from: string; period_to: string; answers_total: number; named_total: number; rivals: Rival[]; discovered: { name: string; answers: number }[]; playbooks: Playbook[]; created_at: string };

export default async function CompetitorsTab() {
  const { supabase, user, brand, subscription } = await getWorkspace();
  if (!brand || brand.onboarding_step < 4) redirect(`/onboarding?step=${brand?.onboarding_step ?? 1}`);
  const [{ data: rows }, { data: tracked }] = await Promise.all([
    supabase.from("competitor_insights").select("id, period_from, period_to, answers_total, named_total, rivals, discovered, playbooks, created_at").eq("brand_id", brand.id).order("created_at", { ascending: false }).limit(2),
    supabase.from("competitors").select("name").eq("brand_id", brand.id).eq("status", "active"),
  ]);
  const [rep, prev] = (rows ?? []) as Report[];
  const trackedNow = new Set(((tracked ?? []) as any[]).map((c) => c.name.toLowerCase()));
  const shell = (c: React.ReactNode) => <DashboardShell active="Competitors" email={user.email} trialDays={trialDaysLeft(subscription)} brandName={brand.name} domain={brand.primary_domain}>{c}</DashboardShell>;

  if (!rep) {
    return shell(
      <section className="card stack-s">
        <h2>Your first competitor report is on its way</h2>
        <p className="muted">{brand.setup_status === "verified" ? "We read your last 30 days of AI answers to see who gets named instead of you — including businesses you haven't listed. It usually appears within an hour." : "It starts once your setup is checked and your first answers are in."}</p>
      </section>,
    );
  }

  const shown = rep.rivals.filter((r) => r.answers > 0);
  const quiet = rep.rivals.filter((r) => r.answers === 0 && r.tracked);
  return shell(
    <>
      <section className="stack-xs">
        <h2>Who AI names instead of you</h2>
        <p className="muted">From {rep.answers_total} AI answers, {day(rep.period_from)} – {day(rep.period_to)}. You were named in {rep.named_total}. Report of {new Date(rep.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}; refreshed monthly.</p>
      </section>

      <section className="card stack-s">
        <div className="table-wrap"><table className="data-table small">
          <thead><tr><th>Business</th><th>Named in</th><th>Named where you aren&apos;t</th><th>By</th><th></th></tr></thead>
          <tbody>
            <tr><td><strong>{brand.name}</strong> <span className="muted">(you)</span></td><td>{rep.named_total} of {rep.answers_total}</td><td>—</td><td></td><td></td></tr>
            {shown.map((r) => {
              const d = winsChange(r, prev?.rivals ?? null);
              const isTracked = r.tracked || trackedNow.has(r.name.toLowerCase());
              return (
                <tr key={r.name}>
                  <td><strong>{r.name}</strong>{!isTracked && <span className="chip" style={{ marginLeft: 8 }}>Not tracked</span>}</td>
                  <td>{r.answers}</td>
                  <td>{r.winsOverYou}{d !== null && d !== 0 ? <span className="muted"> ({d > 0 ? "+" : ""}{d} since last report)</span> : null}</td>
                  <td className="muted">{r.engines.map((e) => ENGINE[e] ?? e).join(", ") || "—"}</td>
                  <td>{!isTracked && (
                    <form action={trackCompetitor}><input type="hidden" name="name" value={r.name} /><PendingButton className="btn btn-secondary btn-s" pending="Adding…">Track</PendingButton></form>
                  )}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        {rep.discovered.length > 0 && <p className="small muted">“Not tracked” businesses were found in your answers by reading them, and each appears in at least 2 answers. Track one to follow it in every future run.</p>}
        {quiet.length > 0 && <p className="small muted">Not named in any answer: {quiet.map((r) => r.name).join(", ")}. AI may not see them as your competition for these questions.</p>}
      </section>

      {rep.playbooks.map((p) => {
        const r = rep.rivals.find((x) => x.name === p.rival);
        if (!r) return null;
        return (
          <section key={p.rival} className="card stack-s">
            <h3>Why AI picks {r.name}</h3>
            <ul className="stack-xs" style={{ margin: 0, paddingLeft: 18 }}>
              {p.why.map((w, i) => {
                const ev = w.refs.map((x) => refLabel(x, r)).filter(Boolean);
                return <li key={i}>{w.text}{ev.length ? <span className="small muted"> — evidence: {[...new Set(ev)].join("; ")}</span> : null}</li>;
              })}
            </ul>
            {p.moves.length > 0 && (<><h4>What you can do</h4><ul className="stack-xs" style={{ margin: 0, paddingLeft: 18 }}>{p.moves.map((m, i) => <li key={i}>{m}</li>)}</ul></>)}
            <div className="grid-2">
              <div className="stack-xs">
                <p className="small"><strong>Questions where they&apos;re named and you aren&apos;t</strong></p>
                <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{r.questions.map((q) => <li key={q.prompt}>{q.prompt} <span className="muted">· {q.answers} answer{q.answers === 1 ? "" : "s"}</span></li>)}</ul>
              </div>
              <div className="stack-xs">
                <p className="small"><strong>Sites those answers cite</strong></p>
                {r.sites.length ? <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{r.sites.map((s) => <li key={s.domain}>{s.domain} <span className="muted">· {s.answers}</span></li>)}</ul> : <p className="small muted">—</p>}
                <p className="small"><Link href="/dashboard/citations">See how to get onto these sites →</Link></p>
              </div>
            </div>
          </section>
        );
      })}
      <p className="small muted">“Why AI picks them” is our reading of the answers and the sites they cite — evidence is listed with each point. The counts are measured.</p>
    </>,
  );
}
