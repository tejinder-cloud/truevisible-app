import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspace, trialDaysLeft } from "@/lib/workspace";
import { TopBar } from "@/components/TopBar";

export const metadata = { title: "Overview" };

const TABS = ["Overview", "Prompts", "Citations", "Recommendations", "Impact", "Reports", "Settings"];
const ENGINE_LABEL: Record<string, string> = { chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity", ai_overviews: "AI Overviews", copilot: "Copilot", meta_ai: "Meta AI" };

/** Every number here comes from a stored row; anything without one renders as "—" (PROJECT-BRIEF honesty standard). */
function Blank() {
  return <span className="blank" aria-label="No data yet">—</span>;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { supabase, user, brand, subscription } = await getWorkspace();
  if (!brand || brand.onboarding_step < 4) redirect(`/onboarding?step=${brand?.onboarding_step ?? 1}`);
  const { welcome } = await searchParams;

  const [prompts, competitors, lastRuns, openRecs, openHall, lastReport] = await Promise.all([
    supabase.from("prompts").select("id", { count: "exact", head: true }).eq("brand_id", brand.id).eq("status", "active"),
    supabase.from("competitors").select("id", { count: "exact", head: true }).eq("brand_id", brand.id).eq("status", "active"),
    supabase.from("runs").select("engine, run_date, status").eq("brand_id", brand.id).order("run_date", { ascending: false }).limit(10),
    supabase.from("recommendations").select("id", { count: "exact", head: true }).eq("brand_id", brand.id).eq("status", "open"),
    supabase.from("hallucinations").select("id", { count: "exact", head: true }).eq("brand_id", brand.id).eq("status", "open"),
    supabase.from("reports").select("kind, created_at, url").eq("brand_id", brand.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const hasRuns = (lastRuns.data?.length ?? 0) > 0;
  const days = trialDaysLeft(subscription);

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

        {brand.setup_status !== "verified" && (
          <section className="card ink stack-s" aria-live="polite">
            <p className="eyebrow" style={{ color: "var(--on-dark)", opacity: 0.75 }}>{welcome ? "Setup received" : "Setup status"}</p>
            <h2>{brand.setup_status === "needs_changes" ? "We need a quick word about your setup." : "We're checking your setup before the first audit."}</h2>
            <p style={{ opacity: 0.85 }}>
              A TGL specialist reviews your competitors and prompts against what AI engines actually say. Once that's done, the first audit runs across every engine and your
              report lands in your inbox. Until then, this page stays blank on purpose — we don't show numbers we haven't measured.
            </p>
            <div className="row">
              <Link className="btn btn-on-dark" href="/onboarding?step=1" style={{ background: "var(--cream)", color: "var(--ink)" }}>
                Review my setup
              </Link>
            </div>
          </section>
        )}

        <section className="grid-stats" aria-label="Visibility summary">
          <div className="card stack-xs"><p className="eyebrow">Visibility score</p><p className="stat"><Blank /></p><p className="small muted">Share of prompts where AI mentions you</p></div>
          <div className="card stack-xs"><p className="eyebrow">Share of voice</p><p className="stat"><Blank /></p><p className="small muted">You vs {competitors.count ?? 0} {competitors.count === 1 ? "competitor" : "competitors"}</p></div>
          <div className="card stack-xs"><p className="eyebrow">Sentiment</p><p className="stat"><Blank /></p><p className="small muted">How AI describes you</p></div>
          <div className="card stack-xs"><p className="eyebrow">What AI gets wrong</p><p className="stat">{hasRuns ? openHall.count ?? 0 : <Blank />}</p><p className="small muted">Open wrong claims</p></div>
        </section>

        <section className="grid-stats">
          <div className="card stack-s">
            <h3>Tracking</h3>
            <dl className="small" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", margin: 0 }}>
              <dt className="muted">Prompts</dt><dd style={{ margin: 0 }}>{prompts.count ?? 0}</dd>
              <dt className="muted">Languages</dt><dd style={{ margin: 0 }}>{brand.languages.map((l) => ({ en: "English", hi: "Hindi", hinglish: "Hinglish" } as Record<string, string>)[l] ?? l).join(", ")}</dd>
              <dt className="muted">Competitors</dt><dd style={{ margin: 0 }}>{competitors.count ?? 0}</dd>
              <dt className="muted">Last run</dt>
              <dd style={{ margin: 0 }}>{hasRuns ? `${lastRuns.data![0].run_date} · ${[...new Set(lastRuns.data!.filter((r) => r.run_date === lastRuns.data![0].run_date).map((r) => ENGINE_LABEL[r.engine] ?? r.engine))].join(", ")}` : <Blank />}</dd>
            </dl>
          </div>
          <div className="card stack-s">
            <h3>Recommendations</h3>
            <p className="stat" style={{ fontSize: 36 }}>{hasRuns ? openRecs.count ?? 0 : <Blank />}</p>
            <p className="small muted">Open, after your first audit.</p>
          </div>
          <div className="card stack-s">
            <h3>Latest report</h3>
            {lastReport.data ? (
              <p className="small">{lastReport.data.kind} · {new Date(lastReport.data.created_at).toLocaleDateString("en-IN")}</p>
            ) : (
              <p className="stat" style={{ fontSize: 36 }}><Blank /></p>
            )}
            <p className="small muted">Reports arrive by email and appear here.</p>
          </div>
        </section>
      </main>
    </>
  );
}
