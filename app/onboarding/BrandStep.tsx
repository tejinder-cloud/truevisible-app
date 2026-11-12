"use client";
import { useActionState, useMemo, useState } from "react";
import { saveBrand, type StepState } from "./actions";
import { suggestVariants } from "@/lib/onboarding/variants";
import { normalizeDomain, splitList } from "@/lib/onboarding/domain";
import { QuestionFlow, type Question } from "@/components/QuestionFlow";

const PLATFORMS = [
  ["wordpress", "WordPress"], ["shopify", "Shopify"], ["webflow", "Webflow"], ["wix", "Wix"],
  ["squarespace", "Squarespace"], ["custom", "Custom-built"], ["none", "No website yet"],
] as const;

type Initial = { name: string; primary_domain: string; site_platform: string; variants: string[]; extra_domains: string[] };

export function BrandStep({ initial }: { initial: Initial }) {
  const [state, action] = useActionState<StepState, FormData>(saveBrand, {});
  const [name, setName] = useState(initial.name);
  const [domain, setDomain] = useState(initial.primary_domain);
  const [platform, setPlatform] = useState(initial.site_platform);
  const suggestions = useMemo(() => suggestVariants(name, platform === "none" ? null : domain), [name, domain, platform]);
  const [checked, setChecked] = useState<Set<string>>(new Set(initial.variants));
  const custom = initial.variants.filter((v) => !suggestVariants(initial.name, initial.primary_domain).includes(v));
  const noSite = platform === "none";
  const brand = name.trim() || "your brand";

  const questions: Question[] = [
    {
      id: "name",
      title: <>What's your <em className="accent">brand</em> called?</>,
      lead: "The name customers know you by.",
      validate: (fd) => (String(fd.get("name") ?? "").trim().length < 2 ? "Add your brand name." : null),
      body: (
        <input type="text" name="name" aria-label="Brand name" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Smile Dental Studio" autoComplete="organization" />
      ),
    },
    {
      id: "platform",
      title: <>What does {brand}'s website run on?</>,
      lead: "This decides how fixes get made later: directly on WordPress and most site builders, or as a paste-ready pack for a custom site.",
      validate: (fd) => (fd.get("site_platform") ? null : "Pick one. Not sure? Choose “Custom-built” and we'll check."),
      body: (
        <fieldset>
          <legend className="sr-only" style={{ position: "absolute", left: -9999 }}>Website platform</legend>
          <div className="choices">
            {PLATFORMS.map(([v, label]) => (
              <label key={v} className="choice">
                <input type="radio" name="site_platform" value={v} checked={platform === v} onChange={() => setPlatform(v)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ),
    },
    {
      id: "domain",
      skip: noSite,
      title: <>What's the website address?</>,
      validate: (fd) => {
        const v = String(fd.get("primary_domain") ?? "");
        if (!v.trim()) return "Add your website address.";
        return normalizeDomain(v) ? null : "That doesn't look like a website address. Try something like yourbusiness.com";
      },
      body: (
        <input type="text" name="primary_domain" aria-label="Website" inputMode="url" autoCapitalize="none" autoCorrect="off"
          value={noSite ? "" : domain} onChange={(e) => setDomain(e.target.value)} placeholder="yourbusiness.com" />
      ),
    },
    {
      id: "variants",
      optional: true,
      isEmpty: (fd) => fd.getAll("variant").length === 0 && !String(fd.get("custom_variants") ?? "").trim(),
      title: <>Does anyone call you something else?</>,
      lead: "Short forms, old names, Hindi spellings. AI engines often use these, so we track them too.",
      body: (
        <div className="stack-m">
          {suggestions.length > 0 && (
            <div className="row">
              {suggestions.map((s) => {
                const on = checked.has(s);
                return (
                  <label key={s} className={`chip chip-l ${on ? "on" : ""}`} style={{ cursor: "pointer" }}>
                    <input type="checkbox" name="variant" value={s} checked={on} style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
                      onChange={() => setChecked((c) => { const n = new Set(c); if (n.has(s)) n.delete(s); else n.add(s); return n; })} />
                    {on ? "✓ " : "+ "}{s}
                  </label>
                );
              })}
            </div>
          )}
          <label className="field">
            <span className="label">Others</span>
            <input type="text" name="custom_variants" defaultValue={custom.join(", ")} placeholder="Separate with commas" />
            {suggestions.length > 0 && <span className="hint">The tags above are suggested from what you typed. Tap the ones that apply.</span>}
          </label>
        </div>
      ),
    },
    {
      id: "extra",
      skip: noSite,
      optional: true,
      isEmpty: (fd) => !String(fd.get("extra_domains") ?? "").trim(),
      title: <>Any other websites you own?</>,
      lead: "A second domain, a blog, a regional site. One per line.",
      validate: (fd) =>
        splitList(String(fd.get("extra_domains") ?? ""), 10).some((d) => !normalizeDomain(d)) ? "One of these doesn't look like a website address." : null,
      body: (
        <textarea name="extra_domains" aria-label="Other websites" defaultValue={initial.extra_domains.join("\n")} rows={3}
          placeholder={"yourbusiness.in\nblog.yourbusiness.com"} />
      ),
    },
  ];

  return (
    <form action={action}>
      <QuestionFlow questions={questions} submitLabel="Continue" pendingLabel="Saving…" serverError={state.error} />
    </form>
  );
}
