import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/site";
import { getWorkspace } from "@/lib/workspace";
import { changePackFilename, changePackMarkdown, inChangePack, type PackAsset, type PackRec } from "@/lib/execution";

// Download the change pack: every open / in-progress on-site recommendation with its ready-to-use asset, as one
// Markdown file a developer can work from. Read with the user's own rights (RLS). The download is logged.
export async function GET(req: NextRequest) {
  const { supabase, brand } = await getWorkspace();
  if (!brand) return NextResponse.redirect(new URL("/dashboard", siteUrl(req.nextUrl.origin)));
  const { data: recs } = await supabase.from("recommendations").select("id, title, body, impact, ease, priority, status, category, asset_refs")
    .eq("brand_id", brand.id).in("status", ["open", "diy"]).order("priority", { ascending: false }).order("created_at", { ascending: false });
  const picked = ((recs ?? []) as (PackRec & { status: string; asset_refs: string[] })[]).filter(inChangePack);
  const ids = picked.map((r) => r.asset_refs?.[0]).filter(Boolean);
  const { data: assets } = ids.length ? await supabase.from("assets").select("id, kind, title, content").in("id", ids) : { data: [] };
  const byId = new Map(((assets ?? []) as (PackAsset & { id: string })[]).map((a) => [a.id, a]));
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const md = changePackMarkdown({ brand: brand.name, domain: brand.primary_domain, platform: brand.site_platform, date, items: picked.map((rec) => ({ rec, asset: byId.get(rec.asset_refs?.[0]) })) });
  if (picked.length) await supabase.rpc("tv_log_change_pack", { p_brand: brand.id, p_recs: picked.map((r) => r.id) });
  return new NextResponse(md, { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${changePackFilename(brand.name, date)}"`, "cache-control": "no-store" } });
}
