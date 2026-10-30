export type Language = "en" | "hi" | "hinglish";
export type Journey = "awareness" | "consideration" | "decision";
export type DraftPrompt = { text: string; language: Language; journey_phase: Journey };

export const LANGUAGES: { id: Language; label: string; v: 1 | 2 }[] = [
  { id: "en", label: "English", v: 1 },
  { id: "hi", label: "Hindi", v: 1 },
  { id: "hinglish", label: "Hinglish", v: 1 },
];
export const LANGUAGES_V2 = ["Punjabi", "Tamil", "Telugu", "Marathi", "Bengali"];

type Ctx = { brand: string; product: string; icp: string; location: string; competitor?: string };
type Tpl = { j: Journey; t: (c: Ctx) => string | null };

// City-level buyer-intent questions, mostly unbranded (that's where visibility is won), a few branded.
const TEMPLATES: Record<Language, Tpl[]> = {
  en: [
    { j: "consideration", t: (c) => `What are the best ${c.product} options in ${c.location} for ${c.icp}?` },
    { j: "decision", t: (c) => `Which ${c.product} in ${c.location} do ${c.icp} trust most?` },
    { j: "awareness", t: (c) => `How much does ${c.product} cost in ${c.location}?` },
    { j: "consideration", t: (c) => `Compare the top ${c.product} providers in ${c.location}` },
    { j: "decision", t: (c) => `Is ${c.brand} a good choice for ${c.product} in ${c.location}?` },
    { j: "consideration", t: (c) => (c.competitor ? `Alternatives to ${c.competitor} for ${c.product} in ${c.location}` : null) },
    { j: "awareness", t: (c) => `What should ${c.icp} check before choosing a ${c.product}?` },
    { j: "decision", t: (c) => `${c.brand} reviews — is it worth it?` },
  ],
  hinglish: [
    { j: "consideration", t: (c) => `${c.location} mein ${c.icp} ke liye best ${c.product} kaunsa hai?` },
    { j: "awareness", t: (c) => `${c.location} mein ${c.product} ki fees kitni hoti hai?` },
    { j: "decision", t: (c) => `${c.brand} ka ${c.product} kaisa hai? Reviews batao` },
    { j: "consideration", t: (c) => `${c.location} ke top ${c.product} options compare karo` },
  ],
  hi: [
    { j: "consideration", t: (c) => `${c.location} में ${c.icp} के लिए सबसे अच्छा ${c.product} कौन सा है?` },
    { j: "awareness", t: (c) => `${c.location} में ${c.product} की फीस कितनी है?` },
    { j: "decision", t: (c) => `क्या ${c.brand} ${c.product} के लिए अच्छा विकल्प है?` },
  ],
};

/**
 * Draft prompts for one product × ICP × location, across the chosen languages, interleaved so a
 * 10-prompt trial still covers every language. These are templates (source = 'template'), labelled as such in the UI.
 */
export function draftPrompts(ctx: Ctx, languages: Language[], limit: number): DraftPrompt[] {
  const langs = languages.length ? languages : (["en"] as Language[]);
  const queues = langs.map((lang) =>
    TEMPLATES[lang]
      .map((tpl) => ({ text: tpl.t(ctx), language: lang, journey_phase: tpl.j }))
      .filter((p): p is DraftPrompt => !!p.text && p.text.length >= 5)
  );
  const out: DraftPrompt[] = [];
  const seen = new Set<string>();
  for (let i = 0; out.length < limit && queues.some((q) => i < q.length); i++) {
    for (const q of queues) {
      if (i < q.length && out.length < limit && !seen.has(q[i].text.toLowerCase())) {
        seen.add(q[i].text.toLowerCase());
        out.push(q[i]);
      }
    }
  }
  return out;
}
