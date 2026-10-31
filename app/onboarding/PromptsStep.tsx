"use client";
import { useActionState, useState } from "react";
import { savePrompts, type StepState } from "./actions";
import { draftPrompts, LANGUAGES, LANGUAGES_V2, type DraftPrompt, type Journey, type Language } from "@/lib/onboarding/prompts";
import { QuestionFlow, type Question } from "@/components/QuestionFlow";

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

  const questions: Question[] = [
    {
      id: "languages",
      title: <>Which languages do your buyers <em className="accent">ask AI</em> in?</>,
      lead: "Pick all that apply. We'll draft questions in each.",
      validate: () => (langs.length ? null : "Pick at least one language."),
      onLeave: () => {
        // Redraft only if the list is still untouched template drafts, so edits are never lost.
        const drafted = new Set(rows.map((r) => r.language));
        const changed = langs.length !== drafted.size || langs.some((l) => !drafted.has(l));
        if (changed && rows.every((r) => r.source === "template")) redraft();
      },
      body: (
        <div className="stack-s">
          <div className="row">
            {LANGUAGES.map((l) => (
              <label key={l.id} className={`chip chip-l ${langs.includes(l.id) ? "on" : ""}`} style={{ cursor: "pointer" }}>
                <input type="checkbox" name="language" value={l.id} checked={langs.includes(l.id)} onChange={() => toggleLang(l.id)}
                  style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} />
                {langs.includes(l.id) ? "✓ " : "+ "}{l.label}
              </label>
            ))}
          </div>
          <p className="hint">Coming later: {LANGUAGES_V2.join(", ")}.</p>
        </div>
      ),
    },
    {
      id: "prompts",
      title: <>The questions we'll ask AI <em className="accent">every day</em></>,
      lead: <>Drafted from your answers ({ctx.product} · {ctx.icp} · {ctx.location}) using our question templates. Edit them freely. Your plan includes {limit}.</>,
      validate: () => (rows.filter((r) => r.text.trim().length >= 5).length ? null : "Add at least one question."),
      body: (
        <div className="card">
          <div className="spread" style={{ marginBottom: 8 }}>
            <button type="button" className="btn-link small" onClick={redraft}>Redraft all</button>
            <span className={`small ${full ? "" : "muted"}`}>{rows.length} of {limit}</span>
          </div>
          {rows.length === 0 && <p className="muted small" style={{ padding: "12px 0" }}>No questions yet. Redraft or add your own.</p>}
          {rows.map((r, i) => (
            <div key={r.key} className="prompt-row">
              <div>
                <textarea aria-label={`Question ${i + 1}`} rows={3} value={r.text} onChange={(e) => update(r.key, { text: e.target.value })} lang={r.language === "hi" ? "hi" : "en"} />
                <div className="meta">
                  <select aria-label="Language" value={r.language} onChange={(e) => update(r.key, { language: e.target.value as Language })}>
                    {(Object.keys(LANG_LABEL) as Language[]).map((l) => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
                  </select>
                  <select aria-label="Buyer journey stage" value={r.journey_phase} onChange={(e) => update(r.key, { journey_phase: e.target.value as Journey })}>
                    {(Object.keys(JOURNEY) as Journey[]).map((j) => <option key={j} value={j}>{JOURNEY[j]}</option>)}
                  </select>
                </div>
              </div>
              <button type="button" className="btn-link small" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`Remove question ${i + 1}`}>
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
          <input type="hidden" name="prompts" value={JSON.stringify(rows.map(({ text, language, journey_phase, source }) => ({ text, language, journey_phase, source })))} />
        </div>
      ),
    },
  ];

  return (
    <form action={action}>
      <QuestionFlow questions={questions} submitLabel="Finish setup" pendingLabel="Saving…" serverError={state.error} backHref="/onboarding?step=2" />
    </form>
  );
}
