import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspace, trialDaysLeft } from "@/lib/workspace";
import { DashboardShell } from "@/components/DashboardShell";
import { AnswerText } from "@/components/AnswerText";
import { ENGINE_LABEL, containsName } from "@/lib/overview";
import { buildPromptRows, dayRange, type HistoryRow, type PromptRow } from "@/lib/tabs";

export const metadata = { title: "Prompts" };
const DAYS = 14;
const LANG: Record<string, string> = { en: "English", hi: "Hindi", hinglish: "Hinglish" };
const STAGE: Record<string, string> = { awareness: "Awareness", consideration: "Consideration", decision: "Decision" };
const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const FILTERS = [{ key: "all", label: "All" }, { key: "missing", label: "Not named" }, { key: "named", label: "Named" }] as const;

export default async function PromptsTab({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { supabase, user, brand, subscription } = await getWorkspace();
  if (!brand || brand.onboarding_step < 4) redirect(`/onboarding?step=${brand?.onboarding_step ?? 1}`);
  const show = (await searchParams).show ?? "all";

  const todayIst = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const from = new Date(Date.parse(todayIst + "T00:00:00Z") - (DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
  const days = dayRange(from, todayIst);

  const [{ data: prompts }, { data: variants }] = await Promise.all([
    supabase.from("prompts").select("id, text, language, journey_phase").eq("brand_id", brand.id).eq("status", "active").order("created_at"),
    supabase.from("brand_variants").select("name").eq("brand_id", brand.id),
  ]);
  const ids = (prompts ?? []).map((p) => p.id as string);

  // Answers from completed runs in the window, paged (the API returns at most 1,000 rows per request).
  const history: HistoryRow[] = [];
  if (ids.length) {
    for (let page = 0; page < 20; page++) {
      const { data } = await supabase.from("answers")
        .select("id, prompt_id, created_at, mentioned, position, competitors_mentioned, runs!inner(engine, run_date, status)")
        .eq("brand_id", brand.id).in("prompt_id", ids).gte("runs.run_date", from).in("runs.status", ["succeeded", "partial"])
        .order("created_at").range(page * 1000, page * 1000 + 999);
      for (const a of (data ?? []) as any[]) history.push({ id: a.id, prompt_id: a.prompt_id, engine: a.runs.engine, run_date: a.runs.run_date, created_at: a.created_at, mentioned: a.mentioned, position: a.position, competitors_mentioned: a.competitors_mentioned });
      if (!data || data.length < 1000) break;
    }
  }
  const names = [brand.name, ...(variants ?? []).map((v) => v.name as string), ...(brand.primary_domain ? [brand.primary_domain] : [])];
  const { rows, engines } = buildPromptRows((prompts ?? []) as any, history, days, (t) => containsName(t, names));

  // Answer text for the latest answer in each cell only.
  const latestIds = rows.flatMap((r) => Object.values(r.latest).filter(Boolean).map((c) => c!.answerId));
  const text = new Map<string, string>();
  for (let i = 0; i < latestIds.length; i += 100) {
    const { data } = await supabase.from("answers").select("id, text").in("id", latestIds.slice(i, i + 100));
    for (const a of data ?? []) text.set(a.id as string, (a.text as string) ?? "");
  }

  const unbranded = rows.filter((r) => !r.branded && r.namedAnywhere != null);
  const unbrandedNamed = unbranded.filter((r) => r.namedAnywhere).length;
  const visible = rows.filter((r) => show === "missing" ? r.namedAnywhere === false : show === "named" ? r.namedAnywhere === true : true);

  return (
    <DashboardShell active="Prompts" email={user.email} trialDays={trialDaysLeft(subscription)} brandName={brand.name} domain={brand.primary_domain}>
      <section className="stack-s">
        <div className="spread" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div className="stack-xs">
            <h2>The questions buyers ask AI</h2>
            <p className="muted">
              {rows.length} active questions · each one&apos;s latest answer from {engines.map((e) => ENGINE_LABEL[e] ?? e).join(", ") || "each engine"}
              {unbranded.length > 0 && <> · <strong style={{ color: "var(--text)" }}>{unbrandedNamed} of {unbranded.length}</strong> questions without your name get you named by at least one AI</>}
            </p>
          </div>
          <Link className="btn btn-secondary" href="/onboarding?step=3">Add or edit questions</Link>
        </div>
        <div className="row" role="group" aria-label="Filter questions" style={{ gap: 8, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <Link key={f.key} href={f.key === "all" ? "/dashboard/prompts" : `/dashboard/prompts?show=${f.key}`} className={`chip filter${show === f.key ? " on" : ""}`} aria-current={show === f.key ? "true" : undefined}>{f.label}</Link>
          ))}
        </div>
        <p className="small muted">
          <span className="dot named" aria-hidden /> named you · <span className="dot not" aria-hidden /> didn&apos;t name you · <span className="dot none" aria-hidden /> not asked that day.
          Position is where you appear among the businesses an answer names. Sentiment: measuring starts soon (—).
        </p>
      </section>

      {!rows.length ? (
        <section className="card"><p className="muted">No active questions yet. <Link href="/onboarding?step=3">Add your questions</Link>.</p></section>
      ) : !visible.length ? (
        <section className="card"><p className="muted">No questions match this filter.</p></section>
      ) : (
        <ul className="prompt-list">
          {visible.map((r) => <PromptItem key={r.id} r={r} engines={engines} days={days} text={text} />)}
        </ul>
      )}
    </DashboardShell>
  );
}

function PromptItem({ r, engines, days, text }: { r: PromptRow; engines: string[]; days: string[]; text: Map<string, string> }) {
  return (
    <li className="card prompt-item">
      <details>
        <summary>
          <div className="stack-xs" style={{ minWidth: 0 }}>
            <p className="prompt-text">{r.text}</p>
            <p className="row small" style={{ gap: 6, flexWrap: "wrap" }}>
              <span className="chip">{LANG[r.language] ?? r.language}</span>
              <span className="chip">{STAGE[r.stage] ?? r.stage}</span>
              {r.branded && <span className="chip" title="Questions with your name almost always get it back">Includes your name</span>}
              {r.competitors.length > 0 && <span className="muted">Names {r.competitors.join(", ")}</span>}
            </p>
          </div>
          <div className="engine-cells">
            {engines.map((e) => {
              const c = r.latest[e];
              return (
                <div key={e} className="engine-cell">
                  <span className="small muted">{ENGINE_LABEL[e] ?? e}</span>
                  {c == null ? <span className="small muted">—</span>
                    : c.mentioned ? <span className="small"><span className="dot named" aria-hidden /> Named{c.position ? ` · #${c.position}` : ""}</span>
                    : <span className="small"><span className="dot not" aria-hidden /> Not named</span>}
                </div>
              );
            })}
          </div>
        </summary>
        <div className="stack-m" style={{ marginTop: 16 }}>
          {engines.map((e) => {
            const c = r.latest[e];
            return (
              <div key={e} className="stack-xs">
                <div className="spread" style={{ flexWrap: "wrap", gap: 8 }}>
                  <h3 style={{ fontSize: 17 }}>{ENGINE_LABEL[e] ?? e}</h3>
                  <span className="history" role="img" aria-label={`Last ${days.length} days: ${r.history[e].map((v, i) => `${fmt(days[i])} ${v == null ? "not asked" : v ? "named" : "not named"}`).join(", ")}`}>
                    {r.history[e].map((v, i) => <span key={i} className={`dot ${v == null ? "none" : v ? "named" : "not"}`} title={`${fmt(days[i])}: ${v == null ? "not asked" : v ? "named you" : "didn't name you"}`} />)}
                    <span className="small muted" style={{ marginLeft: 6 }}>{fmt(days[0])} – {fmt(days[days.length - 1])}</span>
                  </span>
                </div>
                {c ? (
                  <>
                    <p className="small muted">Answer of {fmt(c.date)}{c.competitors.length ? ` · names ${c.competitors.join(", ")}` : ""}</p>
                    {text.get(c.answerId) ? <AnswerText text={text.get(c.answerId)!} /> : <p className="muted">—</p>}
                  </>
                ) : <p className="small muted">Not asked on {ENGINE_LABEL[e] ?? e} in the last {days.length} days.</p>}
              </div>
            );
          })}
        </div>
      </details>
    </li>
  );
}
