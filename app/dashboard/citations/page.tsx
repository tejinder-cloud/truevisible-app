import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspace, trialDaysLeft } from "@/lib/workspace";
import { DashboardShell } from "@/components/DashboardShell";
import { CHANNEL_LABEL } from "@/lib/overview";
import { citationGap, gapAction, type SiteRow } from "@/lib/tabs";

export const metadata = { title: "Citations" };
const RANGES = [{ days: 1, label: "Latest day" }, { days: 7, label: "7 days" }, { days: 30, label: "30 days" }];
const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function Type({ t }: { t: string | null }) {
  return t ? <span className="chip channel">{CHANNEL_LABEL[t] ?? t}</span> : <span className="muted" aria-label="Type not classified yet">—</span>;
}

export default async function CitationsTab({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { supabase, user, brand, subscription } = await getWorkspace();
  if (!brand || brand.onboarding_step < 4) redirect(`/onboarding?step=${brand?.onboarding_step ?? 1}`);
  const asked = Number((await searchParams).days ?? 7);
  const range = RANGES.find((r) => r.days === asked) ?? RANGES[1];

  // Window ends on the latest day with a completed run, so "latest day" matches the Overview.
  const { data: last } = await supabase.from("v_visibility_daily").select("run_date").eq("brand_id", brand.id).order("run_date", { ascending: false }).limit(1).maybeSingle();
  const lastDay = (last?.run_date as string | undefined) ?? null;
  const from = lastDay ? new Date(Date.parse(lastDay + "T00:00:00Z") - (range.days - 1) * 86_400_000).toISOString().slice(0, 10) : null;

  let sites: SiteRow[] = [];
  let urls: { url: string; domain: string; channel_type: string | null; answers: number; named_you: number }[] = [];
  let totalAnswers = 0, namedAnswers = 0;
  const [{ count: competitorCount }] = await Promise.all([supabase.from("competitors").select("id", { count: "exact", head: true }).eq("brand_id", brand.id).eq("status", "active")]);
  if (from) {
    const [s, u, v] = await Promise.all([
      supabase.rpc("citation_summary", { p_brand: brand.id, p_from: from }),
      supabase.rpc("citation_urls", { p_brand: brand.id, p_from: from, p_limit: 15 }),
      supabase.from("v_visibility_daily").select("answers, mentioned").eq("brand_id", brand.id).gte("run_date", from),
    ]);
    sites = (s.data ?? []) as SiteRow[];
    urls = (u.data ?? []) as typeof urls;
    totalAnswers = (v.data ?? []).reduce((n, r) => n + (r.answers as number), 0);
    namedAnswers = (v.data ?? []).reduce((n, r) => n + (r.mentioned as number), 0);
  }
  const withoutYou = totalAnswers - namedAnswers;
  const gap = citationGap(sites);
  const top = [...sites].sort((a, b) => b.answers - a.answers || a.domain.localeCompare(b.domain)).slice(0, 15);
  const owned = sites.filter((s) => s.owned);
  const anyCompetitorGap = gap.some((g) => g.competitor_not_you > 0);

  return (
    <DashboardShell active="Citations" email={user.email} trialDays={trialDaysLeft(subscription)} brandName={brand.name} domain={brand.primary_domain}>
      <section className="stack-s">
        <div className="stack-xs">
          <h2>The pages AI reads before it answers</h2>
          <p className="muted">
            {lastDay ? <>{range.days === 1 ? fmt(lastDay) : `${fmt(from!)} – ${fmt(lastDay)}`} · {totalAnswers} answers · {sites.length} sites cited</> : "No completed run yet."}
          </p>
        </div>
        <div className="row" role="group" aria-label="Time range" style={{ gap: 8, flexWrap: "wrap" }}>
          {RANGES.map((r) => <Link key={r.days} href={`/dashboard/citations?days=${r.days}`} className={`chip filter${r.days === range.days ? " on" : ""}`} aria-current={r.days === range.days ? "true" : undefined}>{r.label}</Link>)}
        </div>
      </section>

      {!lastDay ? (
        <section className="card"><p className="muted">Citations appear after your first audit.</p></section>
      ) : (
        <>
          <section className="card stack-s">
            <div className="stack-xs">
              <p className="eyebrow">Citation gap</p>
              <h3>Where AI looks when it doesn&apos;t name you</h3>
              <p className="small muted">
                {withoutYou} of {totalAnswers} answers didn&apos;t name you. These sites were cited most in those answers — being on them is how you get named.
                {!competitorCount ? <> <Link href="/onboarding?step=2">Add competitors</Link> to see which of these name them instead.</> : !anyCompetitorGap ? " None of them named a tracked competitor in this period." : ""}
              </p>
            </div>
            {!gap.length ? <p className="muted">No gaps in this period — every answer citing a site also named you.</p> : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Site</th><th>Type</th><th>Answers without you</th>{competitorCount ? <th>Names instead</th> : null}<th>What to do</th></tr></thead>
                  <tbody>
                    {gap.map((g) => (
                      <tr key={g.domain}>
                        <td><a href={`https://${g.domain}`} target="_blank" rel="noreferrer nofollow">{g.domain}</a></td>
                        <td><Type t={g.channel_type} /></td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{g.without_you} of {withoutYou}</td>
                        {competitorCount ? <td>{g.competitors.length ? g.competitors.join(", ") : <span className="muted">—</span>}</td> : null}
                        <td className="small">{gapAction(g.channel_type, g.domain)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid-2">
            <section className="card stack-s">
              <div className="spread"><h3>Top sites</h3><span className="small muted">{sites.length} sites</span></div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Site</th><th>Type</th><th>Answers citing</th><th>Named you</th></tr></thead>
                  <tbody>
                    {top.map((s) => (
                      <tr key={s.domain}>
                        <td>{s.domain}{s.owned && <span className="chip channel" style={{ marginLeft: 6 }}>Your site</span>}</td>
                        <td><Type t={s.channel_type} /></td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{s.answers} of {totalAnswers}</td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{s.named_you} of {s.answers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small muted">{owned.length ? `Your site was cited in ${owned.reduce((n, s) => n + s.answers, 0)} answers.` : "Your own site wasn't cited in any answer in this period."}</p>
            </section>

            <section className="card stack-s">
              <div className="spread"><h3>Top pages</h3><span className="small muted">by answers citing</span></div>
              {!urls.length ? <p className="muted">—</p> : (
                <ol className="url-list">
                  {urls.map((u) => (
                    <li key={u.url}>
                      <a href={u.url} target="_blank" rel="noreferrer nofollow" title={u.url}>{u.url.replace(/^https?:\/\/(www\.)?/, "").replace(/[?&]utm_source=openai$/, "")}</a>
                      <span className="small muted" style={{ fontVariantNumeric: "tabular-nums" }}>{u.answers} answers{u.named_you ? ` · ${u.named_you} named you` : ""}</span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="small muted">Gemini gives the site but not the page, so its citations count under Top sites only.</p>
            </section>
          </div>
        </>
      )}
    </DashboardShell>
  );
}
