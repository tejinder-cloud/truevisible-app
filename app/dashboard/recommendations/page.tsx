import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspace, trialDaysLeft } from "@/lib/workspace";
import { DashboardShell } from "@/components/DashboardShell";
import { AnswerText } from "@/components/AnswerText";
import { AssetActions } from "@/components/AssetActions";
import { PendingButton } from "@/components/PendingButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Elapsed } from "@/components/Elapsed";
import { ENGINE_LABEL } from "@/lib/overview";
import { requestWpDraft, requestWpPublish, setRecommendationStatus } from "./actions";
import { canPublish, DRAFTABLE, inChangePack, pathFor, publishAs, wpState, type WpAction } from "@/lib/execution";

export const metadata = { title: "Recommendations" };
const KIND: Record<string, string> = {
  page_draft: "Page draft", faq_block: "FAQ block", json_ld: "Schema (JSON-LD)", llms_txt: "llms.txt", meta: "Titles & meta descriptions",
  gbp_edits: "Google Business Profile edits", directory_list: "Directory list", thread_list: "Thread list", change_pack: "Developer brief", other: "Asset",
};
const CAT: Record<string, string> = { offsite: "Off your site", onsite: "On your site", content: "Content", technical: "Technical" };
const level = (n: number) => (n >= 4 ? "High" : n >= 3 ? "Medium" : "Low");
const effort = (n: number) => (n >= 4 ? "Quick" : n >= 3 ? "Moderate" : "Bigger job");
const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

type Rec = { id: string; title: string; body: string | null; impact: number; ease: number; priority: number; status: string; category: string | null; evidence: any; asset_refs: string[]; created_at: string };
type Act = { id: string; path: string; description: string; status: string; performed_by: string | null; performed_at: string | null; created_at: string; url: string | null };
type Asset = { id: string; kind: string; title: string; content: { format?: string; body?: string } | null };

export default async function RecommendationsTab({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { supabase, user, brand, subscription } = await getWorkspace();
  if (!brand || brand.onboarding_step < 4) redirect(`/onboarding?step=${brand?.onboarding_step ?? 1}`);
  const show = (await searchParams).show;

  const [{ data: recRows }, { data: lastRun }, { data: actionRows }, { data: wpRows }, { data: wpInt }] = await Promise.all([
    supabase.from("recommendations").select("id, title, body, impact, ease, priority, status, category, evidence, asset_refs, created_at").eq("brand_id", brand.id).neq("status", "superseded").order("priority", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("v_visibility_daily").select("run_date").eq("brand_id", brand.id).order("run_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("actions").select("id, path, description, status, performed_by, performed_at, created_at, url").eq("brand_id", brand.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("actions").select("id, recommendation_id, status, url, detail, created_at").eq("brand_id", brand.id).eq("path", "wordpress").order("created_at", { ascending: false }),
    supabase.from("integrations").select("status").eq("brand_id", brand.id).eq("provider", "wordpress").maybeSingle(),
  ]);
  const wpByRec = new Map<string, WpAction>();
  for (const w of (wpRows ?? []) as (WpAction & { recommendation_id: string | null })[]) if (w.recommendation_id && !wpByRec.has(w.recommendation_id)) wpByRec.set(w.recommendation_id, w);
  const wpReady = wpInt?.status === "connected" && canPublish(subscription?.plan);
  const wpBusy = [...wpByRec.values()].some((w) => ["drafting", "publishing"].includes(wpState(w).key));
  const log = (actionRows ?? []) as Act[];
  const justLive = log.filter((a) => a.path === "wordpress" && a.status === "done" && Date.now() - new Date(a.performed_at ?? a.created_at).getTime() < 24 * 3600_000);
  const recs = (recRows ?? []) as Rec[];
  const assetIds = recs.flatMap((r) => r.asset_refs ?? []);
  const { data: assetRows } = assetIds.length ? await supabase.from("assets").select("id, kind, title, content").in("id", assetIds) : { data: [] };
  const assets = new Map(((assetRows ?? []) as Asset[]).map((a) => [a.id, a]));

  const open = recs.filter((r) => r.status === "open");
  const diy = recs.filter((r) => r.status === "diy");
  const done = recs.filter((r) => r.status === "done" || r.status === "managed");
  const dismissed = recs.filter((r) => r.status === "dismissed");
  const packCount = recs.filter(inChangePack).length;
  const path = pathFor(brand.site_platform);
  const latestBatch = recs.reduce<string | null>((m, r) => (!m || r.created_at > m ? r.created_at : m), null);

  return (
    <DashboardShell active="Recommendations" email={user.email} trialDays={trialDaysLeft(subscription)} brandName={brand.name} domain={brand.primary_domain}>
      <AutoRefresh active={wpBusy} />
      {justLive.length > 0 && (
        <section className="card done-banner stack-xs" role="status">
          <h3>✓ Live on your site</h3>
          <ul className="stack-xs" style={{ margin: 0, paddingLeft: 18 }}>
            {justLive.map((a) => <li key={a.id}>{a.url ? <a href={a.url} target="_blank" rel="noopener">{a.description.replace(/^Published (page|blog post): /, "")}</a> : a.description} <span className="small muted">· {a.description.startsWith("Published blog post") ? "blog post" : "page"} · {new Date(a.performed_at ?? a.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span></li>)}
          </ul>
          <p className="small muted">Moved to Done below and listed in <a href="#log">What changed</a>. We&apos;ll see in the coming runs whether AI starts naming you for these questions.</p>
        </section>
      )}
      <section className="card ink stack-s">
        <p className="eyebrow" style={{ color: "var(--on-dark)", opacity: 0.75 }}>Managed AEO</p>
        <h2>Rather have us do all of this?</h2>
        <p style={{ opacity: 0.9 }}>Our team writes the pages, fixes the schema, gets you onto the sites AI cites, and shows you the movement every month — the same playbook we run on our own site.</p>
        <div className="row">
          <a className="btn" href="/dashboard/managed/go" target="_blank" rel="noopener" style={{ background: "var(--cream)", color: "var(--ink)" }}>Start managed AEO</a>
        </div>
      </section>

      {!recs.length ? (
        <section className="card stack-xs">
          <h3>{lastRun && brand.setup_status === "verified" ? "Your first recommendations are being written." : "Recommendations appear after your first audit."}</h3>
          <p className="muted">{lastRun && brand.setup_status === "verified"
            ? "We read every answer AI gave and every site it cited, then draft what to publish and where to get listed. This usually takes under 30 minutes after an audit."
            : "Once your setup is checked and your questions have been asked, we draft what to do — each with a ready-to-use page, FAQ, schema or list."}</p>
        </section>
      ) : (
        <>
          <section className="stack-xs">
            <h2>What to do next</h2>
            <p className="muted">
              {open.length} to do{diy.length ? ` · ${diy.length} you're doing` : ""}{done.length ? ` · ${done.length} done` : ""}
              {latestBatch && <> · written {new Date(latestBatch).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })} from your latest answers · refreshed weekly</>}
            </p>
            <p className="small muted">Impact and effort are our estimate. The measured facts under each item come from your stored answers.</p>
          </section>
          {packCount > 0 && (
            <section className="card stack-xs">
              <div className="spread" style={{ gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h3>Change pack for your {path.label === "Custom site" ? "developer" : `${path.label} site`}</h3>
                  <p className="small muted">{packCount} on-site change{packCount === 1 ? "" : "s"} in one file, in priority order, with the code ready to paste and where it goes.</p>
                </div>
                <a className="btn btn-secondary btn-s" href="/dashboard/recommendations/change-pack">Download change pack</a>
              </div>
              {path.connect === "wordpress" && (wpInt?.status === "connected"
                ? (wpReady ? <p className="small muted">Your WordPress is connected — pages and FAQs below have a <strong>Draft it on WordPress</strong> button.</p> : null)
                : <p className="small muted">On WordPress? <Link href="/dashboard/settings#wordpress">Connect your site</Link> and we can publish these for you.</p>)}
            </section>
          )}
          {open.length > 0 && <ul className="rec-list">{open.map((r, i) => <RecCard key={r.id} r={r} asset={assets.get(r.asset_refs?.[0])} first={i === 0} wp={wpByRec.get(r.id)} wpReady={wpReady} />)}</ul>}
          {diy.length > 0 && <><h3>You&apos;re doing these</h3><ul className="rec-list">{diy.map((r) => <RecCard key={r.id} r={r} asset={assets.get(r.asset_refs?.[0])} wp={wpByRec.get(r.id)} wpReady={wpReady} />)}</ul></>}
          {done.length > 0 && <><h3>Done</h3><ul className="rec-list">{done.map((r) => <RecCard key={r.id} r={r} asset={assets.get(r.asset_refs?.[0])} compact wp={wpByRec.get(r.id)} />)}</ul></>}
          {dismissed.length > 0 && (show === "dismissed"
            ? <><h3>Dismissed</h3><ul className="rec-list">{dismissed.map((r) => <RecCard key={r.id} r={r} asset={assets.get(r.asset_refs?.[0])} compact />)}</ul></>
            : <p className="small muted"><Link href="/dashboard/recommendations?show=dismissed">Show {dismissed.length} dismissed</Link></p>)}
        </>
      )}
      <ActionsLog log={log} />
    </DashboardShell>
  );
}

function Evidence({ ev }: { ev: any }) {
  const prompts = (ev?.prompts ?? []) as { text: string; engines_asked: string[]; engines_named: string[]; competitors_named: string[] }[];
  const sites = (ev?.sites ?? []) as { domain: string; answers_without_you: number; competitor_named: number; competitors: string[] }[];
  if (!prompts.length && !sites.length) return null;
  return (
    <ul className="evidence small">
      {prompts.map((p) => (
        <li key={p.text}>
          <span className="muted">Question:</span> “{p.text}” — named you on {p.engines_named.length} of {p.engines_asked.length} AIs
          {p.engines_asked.length ? ` (${p.engines_asked.map((e) => `${ENGINE_LABEL[e] ?? e} ${p.engines_named.includes(e) ? "✓" : "✗"}`).join(", ")})` : ""}
          {p.competitors_named?.length ? ` · named ${p.competitors_named.join(", ")}` : ""}
        </li>
      ))}
      {sites.map((s) => (
        <li key={s.domain}>
          <span className="muted">Site:</span> {s.domain} — cited in {s.answers_without_you} answers that didn&apos;t name you{s.competitor_named ? `, ${s.competitor_named} of them naming ${s.competitors.join(", ")}` : ""}
        </li>
      ))}
      {ev?.period && <li className="muted">Measured {fmt(ev.period.from)} – {fmt(ev.period.to)}</li>}
    </ul>
  );
}

function StatusButton({ id, status, label, strong }: { id: string; status: string; label: string; strong?: boolean }) {
  return (
    <form action={setRecommendationStatus}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status} />
      <PendingButton className={strong ? "btn btn-secondary btn-s" : "btn-link small"} pending="Saving…">{label}</PendingButton>
    </form>
  );
}

function WpStatus({ wp }: { wp: WpAction }) {
  const s = wpState(wp);
  return (
    <div className="wp-status stack-xs" role="status">
      <p className="small">
        <strong>WordPress:</strong> {s.key === "drafting" || s.key === "publishing" ? <span className="spinner" aria-hidden="true" /> : null}{s.text}
        {(s.key === "drafting" || s.key === "publishing") && (wp.detail?.approved_at || wp.created_at) ? <> · <Elapsed since={(s.key === "publishing" ? wp.detail?.approved_at : null) ?? wp.created_at!} /></> : null}
      </p>
      <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {(s.key === "review" || s.key === "blocked") && wp.url && <a className="btn btn-secondary btn-s" href={wp.url} target="_blank" rel="noopener">{s.key === "blocked" ? "Fill in on WordPress" : "Check the draft"}</a>}
        {(s.key === "review" || s.key === "blocked") && (
          <form action={requestWpPublish}><input type="hidden" name="action" value={wp.id} /><PendingButton className="btn btn-s" pending="Sending…">{s.key === "blocked" ? "I've filled them in — publish" : "Publish"}</PendingButton></form>
        )}
        {s.key === "live" && wp.url && <a className="small" href={wp.url} target="_blank" rel="noopener">View the page →</a>}
      </div>
    </div>
  );
}

function RecCard({ r, asset, first, compact, wp, wpReady }: { r: Rec; asset?: Asset; first?: boolean; compact?: boolean; wp?: WpAction; wpReady?: boolean }) {
  const body = asset?.content?.body ?? "";
  const format = asset?.content?.format ?? "markdown";
  const st = wpState(wp);
  const canDraft = wpReady && asset && DRAFTABLE.has(asset.kind) && (r.status === "open" || r.status === "diy") && (st.key === "none" || st.key === "failed");
  return (
    <li className="card rec stack-s">
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {r.category && <span className="chip">{CAT[r.category] ?? r.category}</span>}
        <span className="chip">Impact: {level(r.impact)}</span>
        <span className="chip">Effort: {effort(r.ease)}</span>
        {asset && <span className="chip">{KIND[asset.kind] ?? asset.kind} included</span>}
      </div>
      <h3 style={{ fontSize: 20 }}>{r.title}</h3>
      {!compact && r.body && <p>{r.body}</p>}
      {!compact && <Evidence ev={r.evidence} />}
      {asset && body && !compact && (
        <details className="asset" open={first && r.status === "open" ? undefined : r.status === "diy" ? true : undefined}>
          <summary>{KIND[asset.kind] ?? "Asset"}: {asset.title}</summary>
          <div className="stack-s" style={{ marginTop: 12 }}>
            {format === "markdown" ? <AnswerText text={body} /> : <pre className="code">{body}</pre>}
            <AssetActions title={asset.title} format={format} body={body} />
          </div>
        </details>
      )}
      {wp && st.key !== "none" && <WpStatus wp={wp} />}
      <div className="row rec-actions" style={{ gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        {canDraft && (
          <form action={requestWpDraft} className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input type="hidden" name="id" value={r.id} />
            {asset!.kind === "page_draft" ? (
              <label className="small row" style={{ gap: 6, alignItems: "center" }}>As
                <select name="as" defaultValue={(asset!.content as any)?.publish_as ?? publishAs({ title: asset!.title, body: body })} className="select-s" title="Page: a service or hub that belongs in your menu. Blog post: an article that explains or answers a question.">
                  <option value="page">a page</option>
                  <option value="post">a blog post</option>
                </select>
              </label>
            ) : <input type="hidden" name="as" value="page" />}
            <PendingButton className="btn btn-s" pending="Starting…">{st.key === "failed" ? "Try the draft again" : "Draft it on WordPress"}</PendingButton>
          </form>
        )}
        {r.status === "open" && !wp && <StatusButton id={r.id} status="diy" label="Do it myself" strong />}
        {r.status === "open" && !canDraft && !wp && <a className="btn btn-secondary btn-s" href={`/dashboard/managed/go?from=${r.id}`} target="_blank" rel="noopener">Have us do it</a>}
        {(r.status === "open" || r.status === "diy") && <StatusButton id={r.id} status="done" label="Mark done" />}
        {r.status === "open" && <StatusButton id={r.id} status="dismissed" label="Not relevant" />}
        {r.status !== "open" && <StatusButton id={r.id} status="open" label="Move back to to-do" />}
      </div>
    </li>
  );
}

const PATH: Record<string, string> = { offsite: "Off your site", wordpress: "WordPress", shopify: "Shopify", webflow: "Webflow", wix: "Wix", squarespace: "Squarespace", change_pack: "Change pack" };
const ACT: Record<string, string> = { planned: "Planned", in_progress: "In progress", done: "Done", failed: "Didn't go through", handed_off: "Handed over" };

/** What changed, where and when — every action on the brand's behalf, newest first. Empty until something happens. */
function ActionsLog({ log }: { log: Act[] }) {
  return (
    <section className="card stack-s" id="log">
      <h3>What changed</h3>
      {!log.length ? (
        <p className="small muted">Nothing yet. When we publish a change, list you on a site, or you download a change pack, it shows here with the date and a link.</p>
      ) : (
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>When</th><th>Where</th><th>What</th><th>Status</th></tr></thead>
          <tbody>
            {log.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.performed_at ?? a.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}</td>
                <td>{PATH[a.path] ?? a.path}</td>
                <td>{a.url ? <a href={a.url} target="_blank" rel="noopener">{a.description}</a> : a.description}{a.performed_by === "customer" ? <span className="muted"> · by you</span> : a.performed_by ? <span className="muted"> · by The Growth Lab</span> : null}</td>
                <td>{ACT[a.status] ?? a.status}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </section>
  );
}
