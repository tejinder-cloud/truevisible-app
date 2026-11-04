import { redirect } from "next/navigation";
import { getWorkspace, promptLimit, trialDaysLeft } from "@/lib/workspace";
import { TopBar } from "@/components/TopBar";
import { BrandStep } from "./BrandStep";
import { MarketStep } from "./MarketStep";
import { PromptsStep } from "./PromptsStep";

export const metadata = { title: "Set up your brand" };
const STEPS = ["Brand", "Competitors & market", "Prompts"];

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const { supabase, user, brand, subscription } = await getWorkspace();
  // Setup stays editable after verification too (until Settings ships); finishing again sends it back for review.

  const finished = (brand?.onboarding_step ?? 1) >= 4;
  const reached = Math.min(brand?.onboarding_step ?? 1, 3);
  const asked = Number((await searchParams).step ?? reached);
  const step = Math.min(Math.max(1, Number.isFinite(asked) ? asked : 1), reached);

  let content: React.ReactNode = null;
  if (step === 1) {
    const [{ data: variants }, { data: domains }] = brand
      ? await Promise.all([
          supabase.from("brand_variants").select("name, source").eq("brand_id", brand.id),
          supabase.from("domains").select("domain, is_primary").eq("brand_id", brand.id),
        ])
      : [{ data: [] }, { data: [] }];
    content = (
      <BrandStep
        initial={{
          name: brand?.name ?? "",
          primary_domain: brand?.primary_domain ?? "",
          site_platform: brand?.site_platform ?? "",
          variants: (variants ?? []).map((v) => v.name),
          extra_domains: (domains ?? []).filter((d) => !d.is_primary).map((d) => d.domain),
        }}
      />
    );
  } else if (step === 2 && brand) {
    const [{ data: comps }, { data: pi }] = await Promise.all([
      supabase.from("competitors").select("name, domain").eq("brand_id", brand.id).eq("source", "user").order("created_at"),
      supabase.from("products_icps").select("product, icp, location").eq("brand_id", brand.id).order("created_at").limit(1).maybeSingle(),
    ]);
    content = (
      <MarketStep
        brandName={brand.name}
        initial={{
          competitors: (comps ?? []).map((c) => (c.domain && c.domain !== c.name ? `${c.name} — ${c.domain}` : c.name)).join("\n"),
          product: pi?.product ?? "",
          icp: pi?.icp ?? "",
          location: pi?.location ?? "",
        }}
      />
    );
  } else if (step === 3 && brand) {
    const [{ data: pi }, { data: comps }, { data: prompts }] = await Promise.all([
      supabase.from("products_icps").select("product, icp, location").eq("brand_id", brand.id).order("created_at").limit(1).maybeSingle(),
      supabase.from("competitors").select("name").eq("brand_id", brand.id).order("created_at").limit(1),
      supabase.from("prompts").select("text, language, journey_phase, source").eq("brand_id", brand.id).eq("status", "active").order("created_at"),
    ]);
    if (!pi) redirect("/onboarding?step=2");
    content = (
      <PromptsStep
        ctx={{ brand: brand.name, product: pi.product, icp: pi.icp, location: pi.location, competitor: comps?.[0]?.name }}
        limit={promptLimit(subscription)}
        initialLanguages={brand.languages?.length ? brand.languages : ["en"]}
        initialPrompts={(prompts ?? []) as never}
      />
    );
  }

  return (
    <>
      <TopBar email={user.email} trialDays={trialDaysLeft(subscription)} />
      <main className="narrow stack-l" style={{ paddingTop: 40, paddingBottom: 96 }}>
        <nav aria-label="Setup progress" className="stack-s">
          <p className="eyebrow">Set up · step {step} of 3</p>
          <ol className="progress" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {STEPS.map((label, i) => {
              const n = i + 1;
              const isDone = n < reached || finished;
              const cls = n === step ? "current" : isDone ? "done" : "";
              return (
                <li key={label} className={`step ${cls}`} aria-current={n === step ? "step" : undefined}>
                  {isDone && n !== step ? <a href={`/onboarding?step=${n}`}>{label}</a> : label}
                </li>
              );
            })}
          </ol>
        </nav>
        {content}
      </main>
    </>
  );
}
