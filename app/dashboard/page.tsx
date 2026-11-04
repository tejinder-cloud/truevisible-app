import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspace, trialDaysLeft } from "@/lib/workspace";
import { TopBar } from "@/components/TopBar";
import { Meter } from "@/components/Meter";
import { VisibilityChart } from "@/components/VisibilityChart";
import { AuditProgress } from "@/components/AuditProgress";
import {
  brandedSplit, CHANNEL_LABEL, ENGINE_LABEL, ENGINE_ORDER, latestDate, overallOn, seriesByEngine, shareOfVoice, topSources,
  type DailyRow, type DomainRow, type LatestAnswer,
} from "@/lib/overview";

export const metadata = { title: "Overview" };

const TABS = ["Overview", "Prompts", "Citations", "Recommendations", "Impact", "Reports", "Settings"];
const ENGINE_COLOR: Record<string, string> = { chatgpt: "var(--eng-chatgpt)", gemini: "var(--eng-gemini)", perplexity: "var(--eng-perplexity)" };
const fmtDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Every number here comes from a stored row; anything without one renders as "—" (PROJECT-BRIEF honesty standard). */
function Blank() {
  return <span className="blank" aria-label="No data yet">—</span>;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { supabase, user, brand, subscription } = await getWorkspace();
  if (!brand || brand.onboarding_step < 4) redirect(`/onboarding?step=${brand?.onboarding_step ?? 1}`);
  const { welcome } = await searchParams;

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [prompts, competitors, variants, daily, openRecs, lastReport] = await Promise.all([
    supabase.from("prompts").select("id").eq("brand_id", brand.id).eq("status", "active"),
    supabase.from("competitors").select("name").eq("brand_id", brand.id).eq("status", "active"),
    supabase.from("brand_variants").select("name").eq("brand_id", brand.id),
    supabase.from("v_visibility_daily").select("run_date, engine, answers, mentioned").eq("brand_id", brand.id).gte("run_date", since),
    supabase.from("recommendations").select("id", { count: "exact", head: true }).eq("brand_id", brand.id).eq("status", "open"),
    supabase.from("reports").select("kind, created_at, url").eq("brand_id", brand.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const activeIds = (prompts.data ?? []).map((p) => p.id as string);
  const promptTotal = activeIds.length;
  // First audit after a setup submission: in progress while any run since the submission is running, or any active
  // question still has no answer (since the submission, or from today's runs — those aren't asked twice).
  let auditActive = false;
  let toAsk = 0;
  if (brand.setup_submitted_at && Date.now() - Date.parse(brand.setup_submitted_at) < 6 * 3600_000 && promptTotal) {
    const todayIst = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
    const from = new Date(Math.min(Date.parse(brand.setup_submitted_at), Date.parse(`${todayIst}T00:00:00+05:30`))).toISOString();
    const [{ data: runsSince }, { data: ansSince }] = await Promise.all([
      supabase.from("runs").select("status").eq("brand_id", brand.id).gte("created_at", brand.setup_submitted_at),
      supabase.from("answers").select("prompt_id, created_at, runs!inner(status)").eq("brand_id", brand.id).gte("created_at", from).in("runs.status", ["succeeded", "partial"]).limit(2000),
    ]);
    const all = new Set((ansSince ?? []).map((a: any) => a.prompt_id as string));
    const before = new Set((ansSince ?? []).filter((a: any) => a.created_at < brand.setup_submitted_at!).map((a: any) => a.prompt_id as string));
    toAsk = activeIds.filter((id) => !before.has(id)).length;          // what this audit asks (stable while it runs)
    const unanswered = activeIds.filter((id) => !all.has(id)).length;
    auditActive = unanswered > 0 || (runsSince ?? []).some((r) => r.status === "running" || r.status === "queued");
  }
  const rows = (daily.data ?? []) as DailyRow[];
  const day = latestDate(rows);
  const hasRuns = day != null;
  const days = trialDaysLeft(subscription);
  const competitorNames = (competitors.data ?? []).map((c) => c.name as string);
  const brandNames = [brand.name, ...(variants.data ?? []).map((v) => v.name as string), ...(brand.primary_domain ? [brand.primary_domain] : [])];

  // Latest day's answers (with their question) and cited domains — only completed runs (views and the inner join enforce it).
  let latest: LatestAnswer[] = [];
  let domains: DomainRow[] = [];
  let latestIds: string[] = [];
  if (day) {
    const [ans, doms] = await Promise.all([
      supabase.from("answers")
        .select("prompt_id, mentioned, competitors_mentioned, prompts(text), runs!inner(engine, run_date, status)")
        .eq("brand_id", brand.id).eq("runs.run_date", day).in("runs.status", ["succeeded", "partial"]).limit(1000),
      supabase.from("v_citation_domains_daily").select("domain, channel_type, owned, citations, answers").eq("brand_id", brand.id).eq("run_date", day).limit(1000),
    ]);
    latest = (ans.data ?? []).map((a: any) => ({
      engine: a.runs?.engine, mentioned: a.mentioned, competitors_mentioned: a.competitors_mentioned, prompt_text: a.prompts?.text ?? "",
    }));
    latestIds = (ans.data ?? []).map((a: any) => a.prompt_id as string);
    domains = (doms.data ?? []) as DomainRow[];
  }
  const activeSet = new Set(activeIds);
  const answeredOnDay = new Set(latestIds.filter((id) => activeSet.has(id))).size;
  const overall = overallOn(rows, day);
  const split = brandedSplit(latest, brandNames);
  const sov = shareOfVoice(latest, competitorNames);
  const sources = topSources(domains);
  const series = seriesByEngine(rows).map((x) => ({ ...x, label: ENGINE_LABEL[x.engine] ?? x.engine, color: ENGINE_COLOR[x.engine] ?? "var(--eng-other)" }));
  const enginesOnDay = ENGINE_ORDER.filter((e) => latest.some((a) => a.engine === e)).map((e) => ENGINE_LABEL[e] ?? e);

  return (
    <>
      <TopBar email={user.email} trialDays={days} />
      <main className="container stack-l" style={{ paddingTop: 32, paddingBottom: 96 }}>
        <div className="stack-xs">
          <p className="eyebrow">{brand.primary_domain ?? "No website"}</p>
          <h1>{brand.name}</h1>
        </div>

        <nav className="tabs" aria-label="Dashboard">
          {TABS.map((t) => (t === "Overview" ? <span key={t} className="active" aria-current="page">{t}</span> : <span key={t} aria-disabled="true" title="Coming in the next build">{t}</span>))}
        </nav>

        {auditActive ? (
          <AuditProgress brandId={brand.id} submittedAt={brand.setup_submitted_at!} promptCount={toAsk || promptTotal} updating={hasRuns} />
        ) : brand.setup_status === "needs_changes" ? (
          <section className="card ink stack-s" aria-live="polite">
            <p className="eyebrow" style={{ color: "var(--on-dark)", opacity: 0.75 }}>{hasRuns ? "Your setup" : "One thing before your first audit"}</p>
            <h2>{brand.setup_note ? "We need a small change to your setup." : "We’re refining your setup."}</h2>
            {brand.setup_note ? (
              <p style={{ opacity: 0.9, borderLeft: "3px solid var(--amber)", paddingLeft: 12 }}>{brand.setup_note}</p>
            ) : (
              <p style={{ opacity: 0.9 }}>We&apos;re refining your competitors and questions so your audit compares you with the right businesses. You don&apos;t need to do anything — we&apos;ll update this page when it&apos;s done.</p>
            )}
            {brand.setup_note && <p style={{ opacity: 0.85 }}>Update it and we&apos;ll check again straight away.</p>}
            <div className="row">
              <Link className="btn" href="/onboarding?step=1" style={{ background: "var(--cream)", color: "var(--ink)" }}>Update my setup</Link>
            </div>
          </section>
        ) : brand.setup_status !== "verified" && !hasRuns ? (
          <section className="card ink stack-s" aria-live="polite">
            <p className="eyebrow" style={{ color: "var(--on-dark)", opacity: 0.75 }}>{welcome ? "Setup received" : "Setup status"}</p>
            <h2>We&apos;re checking your setup before the first audit.</h2>
            <p style={{ opacity: 0.85 }}>
              A TGL specialist reviews your competitors and prompts against what AI engines actually say. Once that&apos;s done, the first audit runs across every engine.
              Until then, this page stays blank on purpose — we don&apos;t show numbers we haven&apos;t measured.
            </p>
            <div className="row">
              <Link className="btn" href="/onboarding?step=1" style={{ background: "var(--cream)", color: "var(--ink)" }}>Review my setup</Link>
            </div>
          </section>
        ) : !hasRuns ? (
          <section className="card ink stack-s" aria-live="polite">
            <p className="eyebrow" style={{ color: "var(--on-dark)", opacity: 0.75 }}>Setup verified</p>
            <h2>Your first audit is running.</h2>
            <p style={{ opacity: 0.85 }}>We&apos;re asking every engine your questions now. Results appear here as each engine finishes — usually within the hour.</p>
          </section>
        ) : null}

        {hasRuns && !auditActive && brand.setup_status === "pending_verification" && (
          <p className="notice">We&apos;re also checking your setup by hand and may refine your competitors and questions. Your numbers update when we do.</p>
        )}
        {hasRuns && (
          <p className="small muted">
            Latest completed run: <strong>{fmtDay(day!)}</strong> · {enginesOnDay.join(", ")} · {latest.length} answers covering {answeredOnDay} of your {promptTotal} questions.{" "}
            {answeredOnDay < promptTotal && !auditActive && ` The other ${promptTotal - answeredOnDay} are asked in the next daily run (6:00 AM).`}
            Answers come from each engine&apos;s API with web search on — close to, not identical with, what a person sees in the app.
          </p>
        )}

        <section className="grid-2" aria-label="Visibility">
          <div className="card stack-s">
            <p className="eyebrow">Visibility score</p>
            <Meter pct={overall?.pct ?? null} n={overall?.n} of={overall?.of} label="Visibility score" />
            <p className="small muted">Share of all answers on the latest day that name {brand.name}.</p>
          </div>
          <div className="card stack-s">
            <p className="eyebrow">When buyers don&apos;t ask for you by name</p>
            <div className="split">
              <div className="stack-xs">
                <p className="stat" style={{ fontSize: 44 }}>{split.unbranded ? `${split.unbranded.pct}%` : <Blank />}</p>
                <p className="small"><strong>Unbranded questions</strong></p>
                <p className="small muted">{split.unbranded ? `${split.unbranded.n} of ${split.unbranded.of} answers name you` : hasRuns ? "No unbranded questions" : "No completed run yet"}</p>
              </div>
              <div className="stack-xs">
                <p className="stat" style={{ fontSize: 44, color: "var(--text-2)" }}>{split.branded ? `${split.branded.pct}%` : <Blank />}</p>
                <p className="small"><strong>Questions that include your name</strong></p>
                <p className="small muted">{split.branded ? `${split.branded.n} of ${split.branded.of} answers name you` : hasRuns ? "No branded questions" : "No completed run yet"}</p>
              </div>
            </div>
            <p className="small muted">A question with your name in it almost always gets your name back. The unbranded number is the one that shows whether AI recommends you.</p>
          </div>
        </section>

        <section className="card stack-s" aria-label="Visibility over time">
          <div className="spread"><h3>Visibility over time, by engine</h3><span className="small muted">last 30 days</span></div>
          {series.length ? <VisibilityChart series={series} /> : <p className="muted"><Blank /> No completed runs yet.</p>}
        </section>

        <section className="grid-2">
          <div className="card stack-s" aria-label="Share of voice">
            <div className="spread"><h3>Share of voice</h3>{hasRuns && <span className="small muted">{fmtDay(day!)}</span>}</div>
            {!hasRuns ? (
              <p className="muted"><Blank /> After your first audit.</p>
            ) : !sov ? (
              <p className="small muted">No competitors to compare with yet. <Link href="/onboarding?step=2">Add competitors</Link> and we&apos;ll show how often AI names each of them against you.</p>
            ) : (
              <table className="data-table">
                <thead><tr><th scope="col">Business</th><th scope="col">Answers naming it</th><th scope="col" style={{ width: "35%" }}>Share</th></tr></thead>
                <tbody>
                  {sov.map((r) => (
                    <tr key={r.isBrand ? "_brand" : r.name}>
                      <th scope="row" style={{ fontWeight: r.isBrand ? 600 : 400 }}>{r.isBrand ? `${brand.name} (you)` : r.name}</th>
                      <td>{r.answers} of {latest.length}</td>
                      <td><div className="row" style={{ flexWrap: "nowrap", gap: 8 }}><div className="bar-track" style={{ flex: 1 }}><div className={`bar-fill ${r.isBrand ? "brand" : ""}`} style={{ width: `${r.share}%` }} /></div><span className="small">{r.share}%</span></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card stack-s" aria-label="Top cited sources">
            <div className="spread"><h3>Sources AI cites</h3>{hasRuns && <span className="small muted">{sources.total} sites · {fmtDay(day!)}</span>}</div>
            {!hasRuns || !sources.rows.length ? (
              <p className="muted"><Blank /> After your first audit.</p>
            ) : (
              <>
                <table className="data-table">
                  <thead><tr><th scope="col">Site</th><th scope="col">Type</th><th scope="col">Answers citing it</th></tr></thead>
                  <tbody>
                    {sources.rows.map((d) => (
                      <tr key={d.domain}>
                        <th scope="row">{d.domain}</th>
                        <td>{d.channel_type ? <span className="chip channel">{CHANNEL_LABEL[d.channel_type] ?? d.channel_type}</span> : <Blank />}</td>
                        <td>{d.answers} of {latest.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="small muted">
                  {sources.ownedAnswers ? `Your own site was cited in ${sources.ownedAnswers} answers.` : "Your own site wasn't cited in any answer on this day."} These are the pages AI reads before answering — being on them is how you get named.
                </p>
              </>
            )}
          </div>
        </section>

        <section className="grid-stats">
          <div className="card stack-xs"><p className="eyebrow">Sentiment</p><p className="stat" style={{ fontSize: 36 }}><Blank /></p><p className="small muted">How AI describes you · measuring starts soon</p></div>
          <div className="card stack-xs"><p className="eyebrow">What AI gets wrong</p><p className="stat" style={{ fontSize: 36 }}><Blank /></p><p className="small muted">Wrong claims about you · checking starts soon</p></div>
          <div className="card stack-xs"><p className="eyebrow">Recommendations</p><p className="stat" style={{ fontSize: 36 }}>{openRecs.count ? openRecs.count : <Blank />}</p><p className="small muted">{openRecs.count ? "Open" : hasRuns ? "Not generated yet" : "Appear after your first audit"}</p></div>
          <div className="card stack-xs"><p className="eyebrow">Latest report</p>{lastReport.data ? <p className="small">{lastReport.data.kind} · {new Date(lastReport.data.created_at).toLocaleDateString("en-IN")}</p> : <p className="stat" style={{ fontSize: 36 }}><Blank /></p>}<p className="small muted">Reports arrive by email and appear here.</p></div>
        </section>

        <p className="small muted">Tracking {promptTotal} questions · {competitorNames.length} competitors · {brand.languages.map((l) => ({ en: "English", hi: "Hindi", hinglish: "Hinglish" } as Record<string, string>)[l] ?? l).join(", ")} · <Link href="/onboarding?step=1">Edit setup</Link></p>
      </main>
    </>
  );
}
