"use client";
import { useActionState, useMemo, useState } from "react";
import { saveBrand, type StepState } from "./actions";
import { suggestVariants } from "@/lib/onboarding/variants";
import { SubmitButton } from "@/components/SubmitButton";

const PLATFORMS = [
  ["wordpress", "WordPress"], ["shopify", "Shopify"], ["webflow", "Webflow"], ["wix", "Wix"],
  ["squarespace", "Squarespace"], ["custom", "Custom-built"], ["none", "No website"],
] as const;

type Initial = { name: string; primary_domain: string; site_platform: string; variants: string[]; extra_domains: string[] };

export function BrandStep({ initial }: { initial: Initial }) {
  const [state, action] = useActionState<StepState, FormData>(saveBrand, {});
  const [name, setName] = useState(initial.name);
  const [domain, setDomain] = useState(initial.primary_domain);
  const [platform, setPlatform] = useState(initial.site_platform);
  const suggestions = useMemo(() => suggestVariants(name, domain), [name, domain]);
  const [checked, setChecked] = useState<Set<string>>(new Set(initial.variants));
  const custom = initial.variants.filter((v) => !suggestVariants(initial.name, initial.primary_domain).includes(v));

  return (
    <form action={action} className="stack-l">
      <header className="stack-xs">
        <h1>Your <em className="accent">brand</em></h1>
        <p className="muted">How AI engines might name you, and where your website lives.</p>
      </header>

      <div className="card stack-m">
        <label className="field">
          <span className="label">Brand name</span>
          <input type="text" name="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Navkiran Nursing Classes" autoComplete="organization" />
        </label>

        <label className="field">
          <span className="label">Website</span>
          <input type="text" name="primary_domain" inputMode="url" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="yourbusiness.com" />
        </label>

        {suggestions.length > 0 && (
          <fieldset>
            <legend>Other names people and AI use for you</legend>
            <div className="row">
              {suggestions.map((s) => {
                const on = checked.has(s);
                return (
                  <label key={s} className={`chip ${on ? "on" : ""}`} style={{ cursor: "pointer" }}>
                    <input type="checkbox" name="variant" value={s} checked={on} style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
                      onChange={() => setChecked((c) => { const n = new Set(c); if (n.has(s)) n.delete(s); else n.add(s); return n; })} />
                    {on ? "✓ " : "+ "}{s}
                  </label>
                );
              })}
            </div>
            <span className="hint">Suggested from what you typed. Tap the ones that apply.</span>
          </fieldset>
        )}

        <label className="field">
          <span className="label">Any other names? <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></span>
          <input type="text" name="custom_variants" defaultValue={custom.join(", ")} placeholder="Old name, Hindi spelling, short form — separate with commas" />
        </label>

        <label className="field">
          <span className="label">Other websites you own <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></span>
          <textarea name="extra_domains" defaultValue={initial.extra_domains.join("\n")} placeholder={"One per line, e.g.\nyourbusiness.in\nblog.yourbusiness.com"} />
        </label>
      </div>

      <div className="card stack-s">
        <fieldset>
          <legend>What does your website run on?</legend>
          <div className="choices">
            {PLATFORMS.map(([v, label]) => (
              <label key={v} className="choice">
                <input type="radio" name="site_platform" value={v} checked={platform === v} onChange={() => setPlatform(v)} required />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="hint">This decides how fixes get made later — directly on WordPress and most site builders, or as a paste-ready pack for a custom site. Not sure? Pick “Custom-built”; we'll check.</p>
      </div>

      {state.error && <p className="error" role="alert">{state.error}</p>}
      <div className="spread">
        <span />
        <SubmitButton pending="Saving…">Continue</SubmitButton>
      </div>
    </form>
  );
}
