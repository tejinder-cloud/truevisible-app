"use server";
import { redirect } from "next/navigation";
import { getWorkspace, promptLimit } from "@/lib/workspace";
import { normalizeDomain, splitList } from "@/lib/onboarding/domain";
import type { DraftPrompt } from "@/lib/onboarding/prompts";

export type StepState = { error?: string };

const PLATFORMS = ["wordpress", "shopify", "webflow", "wix", "squarespace", "custom", "none"];
const LANGS = ["en", "hi", "hinglish"];
const PHASES = ["awareness", "consideration", "decision"];

function fail(error: string): StepState {
  return { error };
}

// ── Step 1: Brand ──────────────────────────────────────────────────────────
export async function saveBrand(_prev: StepState, fd: FormData): Promise<StepState> {
  const { supabase, user, tenantId, brand } = await getWorkspace();
  const name = String(fd.get("name") ?? "").trim();
  const platform = String(fd.get("site_platform") ?? "");
  const rawDomain = String(fd.get("primary_domain") ?? "");
  const primary = rawDomain.trim() ? normalizeDomain(rawDomain) : null;

  if (name.length < 2) return fail("Add your brand name.");
  if (rawDomain.trim() && !primary) return fail("That website doesn't look right — try something like yourbusiness.com");
  if (!PLATFORMS.includes(platform)) return fail("Pick what your website runs on (choose “No website” if you don't have one).");
  if (platform !== "none" && !primary) return fail("Add your website, or choose “No website”.");

  const extras = splitList(String(fd.get("extra_domains") ?? ""), 10).map(normalizeDomain);
  if (extras.some((d) => !d)) return fail("One of the extra websites doesn't look like a domain.");
  const domains = [...new Set([primary, ...extras].filter((d): d is string => !!d))];
  const variants = [
    ...fd.getAll("variant").map(String),
    ...splitList(String(fd.get("custom_variants") ?? ""), 10),
  ].map((v) => v.trim()).filter((v) => v && v.toLowerCase() !== name.toLowerCase());
  const suggested = new Set(fd.getAll("variant").map(String));

  let brandId = brand?.id;
  if (brandId) {
    const { error } = await supabase.from("brands").update({ name, primary_domain: primary, site_platform: platform }).eq("id", brandId);
    if (error) return fail(`Couldn't save: ${error.message}`);
  } else {
    const { data, error } = await supabase
      .from("brands")
      .insert({ tenant_id: tenantId, name, primary_domain: primary, site_platform: platform, onboarding_step: 2 })
      .select("id")
      .single();
    if (error) return fail(`Couldn't save: ${error.message}`);
    brandId = data.id;
  }

  const del1 = await supabase.from("brand_variants").delete().eq("brand_id", brandId);
  const del2 = await supabase.from("domains").delete().eq("brand_id", brandId);
  if (del1.error || del2.error) return fail("Couldn't update your details. Try again.");
  const uniqVariants = [...new Map(variants.map((v) => [v.toLowerCase(), v])).values()].slice(0, 12);
  if (uniqVariants.length) {
    const { error } = await supabase.from("brand_variants").insert(
      uniqVariants.map((v) => ({ tenant_id: tenantId, brand_id: brandId!, name: v, source: suggested.has(v) ? "suggested" : "user" }))
    );
    if (error) return fail(`Couldn't save name variations: ${error.message}`);
  }
  if (domains.length) {
    const { error } = await supabase.from("domains").insert(
      domains.map((d) => ({ tenant_id: tenantId, brand_id: brandId!, domain: d, is_primary: d === primary }))
    );
    if (error) return fail(`Couldn't save websites: ${error.message}`);
  }
  if (brand && brand.onboarding_step < 2) await supabase.from("brands").update({ onboarding_step: 2 }).eq("id", brandId);
  // Name a fresh workspace after its first brand (was "My workspace", or an email domain like "gmail.com" before 31 Oct).
  const emailDomain = user.email?.split("@")[1] ?? "";
  const { data: tenant } = await supabase.from("tenants").select("name").eq("id", tenantId).maybeSingle();
  if (tenant && (tenant.name === "My workspace" || tenant.name === emailDomain)) {
    await supabase.from("tenants").update({ name }).eq("id", tenantId);
  }
  redirect("/onboarding?step=2");
}

// ── Step 2: Competitors, product, ICP, location ────────────────────────────
export async function saveMarket(_prev: StepState, fd: FormData): Promise<StepState> {
  const { supabase, tenantId, brand } = await getWorkspace();
  if (!brand) redirect("/onboarding?step=1");

  const product = String(fd.get("product") ?? "").trim();
  const icp = String(fd.get("icp") ?? "").trim();
  const location = String(fd.get("location") ?? "").trim();
  if (product.length < 2) return fail("Add the product or service you want to be found for.");
  if (icp.length < 2) return fail("Add who buys it.");
  if (location.length < 2) return fail("Add the city or area you serve.");

  const lines = String(fd.get("competitors") ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 10);
  const competitors: { name: string; domain: string | null }[] = [];
  for (const line of lines) {
    // "Name — website", "Name | website", "Name, website", or just a name / a website
    const [rawName, rawDomain] = line.split(/\s+[—–-]\s+|\s*\|\s*|\s*,\s*/);
    const nm = (rawName ?? "").trim();
    if (!nm) continue;
    competitors.push({ name: nm, domain: normalizeDomain(rawDomain ?? nm) });
  }
  const uniq = [...new Map(competitors.map((c) => [c.name.toLowerCase(), c])).values()];

  const del = await supabase.from("competitors").delete().eq("brand_id", brand.id).eq("source", "user");
  if (del.error) return fail("Couldn't update competitors. Try again.");
  if (uniq.length) {
    const { error } = await supabase.from("competitors").insert(uniq.map((c) => ({ tenant_id: tenantId, brand_id: brand.id, name: c.name, domain: c.domain, source: "user" })));
    if (error) return fail(`Couldn't save competitors: ${error.message}`);
  }

  const { data: existing } = await supabase.from("products_icps").select("id").eq("brand_id", brand.id).order("created_at").limit(1).maybeSingle();
  const res = existing
    ? await supabase.from("products_icps").update({ product, icp, location }).eq("id", existing.id)
    : await supabase.from("products_icps").insert({ tenant_id: tenantId, brand_id: brand.id, product, icp, location });
  if (res.error) return fail(`Couldn't save: ${res.error.message}`);

  if (brand.onboarding_step < 3) await supabase.from("brands").update({ onboarding_step: 3 }).eq("id", brand.id);
  redirect("/onboarding?step=3");
}

// ── Step 3: Prompts ────────────────────────────────────────────────────────
export async function savePrompts(_prev: StepState, fd: FormData): Promise<StepState> {
  const { supabase, tenantId, brand, subscription } = await getWorkspace();
  if (!brand) redirect("/onboarding?step=1");

  const selected = fd.getAll("language").map(String).filter((l) => LANGS.includes(l));

  let prompts: (DraftPrompt & { source?: string })[] = [];
  try {
    prompts = JSON.parse(String(fd.get("prompts") ?? "[]"));
  } catch {
    return fail("Something went wrong reading your prompts. Refresh and try again.");
  }
  prompts = prompts
    .map((p) => ({ ...p, text: String(p.text ?? "").trim().replace(/\s+/g, " ") }))
    .filter((p) => p.text.length >= 5);
  const limit = promptLimit(subscription);
  if (!prompts.length) return fail("Add at least one prompt — draft them from your answers, or write your own.");
  if (prompts.length > limit) return fail(`Your plan includes ${limit} prompts. Remove ${prompts.length - limit} to continue.`);
  if (prompts.some((p) => !LANGS.includes(p.language) || !PHASES.includes(p.journey_phase) || p.text.length > 500)) {
    return fail("One of the prompts has a missing language or journey stage.");
  }

  // languages tracked = the ones ticked plus any a prompt is written in
  const languages = [...new Set([...selected, ...prompts.map((p) => p.language)])];

  const { data: pi } = await supabase.from("products_icps").select("id").eq("brand_id", brand.id).order("created_at").limit(1).maybeSingle();
  const del = await supabase.from("prompts").delete().eq("brand_id", brand.id);
  if (del.error) return fail("Couldn't update prompts. Try again.");
  const { error } = await supabase.from("prompts").insert(
    prompts.map((p) => ({
      tenant_id: tenantId,
      brand_id: brand.id,
      product_icp_id: pi?.id ?? null,
      text: p.text,
      language: p.language,
      journey_phase: p.journey_phase,
      status: "active",
      source: p.source === "template" ? "template" : "user",
    }))
  );
  if (error) return fail(`Couldn't save prompts: ${error.message}`);

  const upd = await supabase
    .from("brands")
    .update({ languages, onboarding_step: 4, setup_status: "pending_verification", setup_note: null })
    .eq("id", brand.id);
  if (upd.error) return fail(`Couldn't finish setup: ${upd.error.message}`);
  redirect("/dashboard?welcome=1");
}
