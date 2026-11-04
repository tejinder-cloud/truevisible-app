import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspace, trialDaysLeft } from "@/lib/workspace";
import { DashboardShell } from "@/components/DashboardShell";
import { AnswerText } from "@/components/AnswerText";
import { AssetActions } from "@/components/AssetActions";
import { ENGINE_LABEL } from "@/lib/overview";
import { setRecommendationStatus } from "./actions";

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
type Asset = { id: string; kind: string; title: string; content: { format?: string; body?: string } | null };

export default async function RecommendationsTab({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { supabase, user, brand, subscription } = await getWorkspace();
  if (!brand || brand.onboarding_step < 4) redirect(`/onboarding?step=${brand?.onboarding_step ?? 1}`);
  const show = (await searchParams).show;

  const [{ data: recRows }, { data: lastRun }] = await Promise.all([
    supabase.from("recommendations").select("id, title, body, impact, ease, priority, status, category, evidence, asset_refs, created_at").eq("brand_id", brand.id).neq("status", "superseded").order("priority", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("v_visibility_daily").select("run_date").eq("brand_id", brand.id).order("run_date", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const recs = (recRows ?? []) as Rec[];
  const assetIds = recs.flatMap((r) => r.asset_refs ?? []);
  const { data: assetRows } = assetIds.length ? await supabase.from("assets").select("id, kind, title, content").in("id", assetIds) : { data: [] };
  const assets = new Map(((assetRows ?? []) as Asset[]).map((a) => [a.id, a]));

  const open = recs.filter((r) => r.status === "open");
  const diy = recs.filter((r) => r.status === "diy");
  const done = recs.filter((r) => r.status === "done" || r.status === "managed");
  const dismissed = recs.filter((r) => r.status === "dismissed");
  const latestBatch = recs.reduce<string | null>((m, r) => (!m || r.created_at > m ? r.created_at : m), null);

  return (
    <DashboardShell active="Recommendations" email={user.email} trialDays={trialDaysLeft(subscription)} brandName={brand.name} domain={brand.primary_domain}>
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
          {open.length > 0 && <ul className="rec-list">{open.map((r, i) => <RecCard key={r.id} r={r} asset={assets.get(r.asset_refs?.[0])} first={i === 0} />)}</ul>}
          {diy.length > 0 && <><h3>You&apos;re doing these</h3><ul className="rec-list">{diy.map((r) => <RecCard key={r.id} r={r} asset={assets.get(r.asset_refs?.[0])} />)}</ul></>}
          {done.length > 0 && <><h3>Done</h3><ul className="rec-list">{done.map((r) => <RecCard key={r.id} r={r} asset={assets.get(r.asset_refs?.[0])} compact />)}</ul></>}
          {dismissed.length > 0 && (show === "dismissed"
            ? <><h3>Dismissed</h3><ul className="rec-list">{dismissed.map((r) => <RecCard key={r.id} r={r} asset={assets.get(r.asset_refs?.[0])} compact />)}</ul></>
            : <p className="small muted"><Link href="/dashboard/recommendations?show=dismissed">Show {dismissed.length} dismissed</Link></p>)}
        </>
      )}
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
      <button type="submit" className={strong ? "btn btn-secondary btn-s" : "btn-link small"}>{label}</button>
    </form>
  );
}

function RecCard({ r, asset, first, compact }: { r: Rec; asset?: Asset; first?: boolean; compact?: boolean }) {
  const body = asset?.content?.body ?? "";
  const format = asset?.content?.format ?? "markdown";
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
      <div className="row rec-actions" style={{ gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        {r.status === "open" && <StatusButton id={r.id} status="diy" label="Do it myself" strong />}
        {r.status === "open" && <a className="btn btn-secondary btn-s" href={`/dashboard/managed/go?from=${r.id}`} target="_blank" rel="noopener">Have us do it</a>}
        {(r.status === "open" || r.status === "diy") && <StatusButton id={r.id} status="done" label="Mark done" />}
        {r.status === "open" && <StatusButton id={r.id} status="dismissed" label="Not relevant" />}
        {r.status !== "open" && <StatusButton id={r.id} status="open" label="Move back to to-do" />}
      </div>
    </li>
  );
}
