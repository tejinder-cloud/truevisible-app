"use client";
import { useActionState, useState } from "react";
import { savePrompts, type StepState } from "./actions";
import { draftPrompts, LANGUAGES, LANGUAGES_V2, type DraftPrompt, type Journey, type Language } from "@/lib/onboarding/prompts";
import { SubmitButton } from "@/components/SubmitButton";

type Row = DraftPrompt & { source: "template" | "user"; key: number };
type Ctx = { brand: string; product: string; icp: string; location: string; competitor?: string };
const JOURNEY: Record<Journey, string> = { awareness: "Awareness", consideration: "Consideration", decision: "Decision" };
const LANG_LABEL: Record<Language, string> = { en: "English", hi: "Hindi", hinglish: "Hinglish" };

let k = 0;
const withKey = (p: DraftPrompt, source: Row["source"]): Row => ({ ...p, source, key: ++k });

export function PromptsStep({ ctx, limit, initialLanguages, initialPrompts }: {
  ctx: Ctx; limit: number; initialLanguages: string[]; initialPrompts: (DraftPrompt & { source: string })[];
}) {
  const [state, action] = useActionState<StepState, FormData>(savePrompts, {});
  const [langs, setLangs] = useState<Language[]>(initialLanguages.filter((l): l is Language => ["en", "hi", "hinglish"].includes(l)));
  const [rows, setRows] = useState<Row[]>(() =>
    initialPrompts.length
      ? initialPrompts.map((p) => withKey(p, p.source === "template" ? "template" : "user"))
      : draftPrompts(ctx, langs.length ? langs : ["en"], limit).map((p) => withKey(p, "template"))
  );
  const full = rows.length >= limit;

  const toggleLang = (l: Language) => setLangs((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));
  const redraft = () => setRows(draftPrompts(ctx, langs.length ? langs : ["en"], limit).map((p) => withKey(p, "template")));
  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, source: patch.text !== undefined ? "user" : r.source } : r)));

  return (
    <form action={action} className="stack-l">
      <header className="stack-xs">
        <h1>The questions buyers <em className="accent">ask AI</em></h1>
        <p className="muted">
          We'll ask every engine these questions daily and record whether {ctx.brand} comes up. Your plan includes {limit} prompts.
        </p>
      </header>

      <div className="card stack-s">
        <fieldset>
          <legend>Languages</legend>
          <div className="row">
            {LANGUAGES.map((l) => (
              <label key={l.id} className={`chip ${langs.includes(l.id) ? "on" : ""}`} style={{ cursor: "pointer" }}>
                <input type="checkbox" name="language" value={l.id} checked={langs.includes(l.id)} onChange={() => toggleLang(l.id)}
                  style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} />
                {langs.includes(l.id) ? "✓ " : "+ "}{l.label}
              </label>
            ))}
          </div>
          <span className="hint">Coming later: {LANGUAGES_V2.join(", ")}.</span>
        </fieldset>
        <div className="row">
          <button type="button" className="btn btn-secondary" onClick={redraft}>Redraft prompts for these languages</button>
        </div>
        <p className="hint">
          Drafted from your answers ({ctx.product} · {ctx.icp} · {ctx.location}) using our question templates. Edit them freely — your words beat ours.
        </p>
      </div>

      <div className="card">
        <div className="spread" style={{ marginBottom: 8 }}>
          <h3>Prompts</h3>
          <span className={`small ${full ? "" : "muted"}`}>{rows.length} of {limit}</span>
        </div>
        {rows.length === 0 && <p className="muted small" style={{ padding: "12px 0" }}>No prompts yet. Redraft above or add your own.</p>}
        {rows.map((r, i) => (
          <div key={r.key} className="prompt-row">
            <div>
              <label className="sr-only" htmlFor={`p${r.key}`} style={{ position: "absolute", left: -9999 }}>Prompt {i + 1}</label>
              <textarea id={`p${r.key}`} rows={3} value={r.text} onChange={(e) => update(r.key, { text: e.target.value })} lang={r.language === "hi" ? "hi" : "en"} />
              <div className="meta">
                <select aria-label="Language" value={r.language} onChange={(e) => update(r.key, { language: e.target.value as Language })}>
                  {(Object.keys(LANG_LABEL) as Language[]).map((l) => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
                </select>
                <select aria-label="Buyer journey stage" value={r.journey_phase} onChange={(e) => update(r.key, { journey_phase: e.target.value as Journey })}>
                  {(Object.keys(JOURNEY) as Journey[]).map((j) => <option key={j} value={j}>{JOURNEY[j]}</option>)}
                </select>
              </div>
            </div>
            <button type="button" className="btn-link small" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`Remove prompt ${i + 1}`}>
              Remove
            </button>
          </div>
        ))}
        <div style={{ paddingTop: 12 }}>
          <button type="button" className="btn btn-secondary" disabled={full}
            onClick={() => setRows((rs) => [...rs, withKey({ text: "", language: langs[0] ?? "en", journey_phase: "consideration" }, "user")])}>
            {full ? `Plan limit reached (${limit})` : "+ Add your own"}
          </button>
        </div>
      </div>

      <input type="hidden" name="prompts" value={JSON.stringify(rows.map(({ text, language, journey_phase, source }) => ({ text, language, journey_phase, source })))} />
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <div className="spread">
        <a className="btn btn-secondary" href="/onboarding?step=2">Back</a>
        <SubmitButton pending="Saving…">Finish setup</SubmitButton>
      </div>
    </form>
  );
}
