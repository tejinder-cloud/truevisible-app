// Impact tab (plan Day 24): AI-referred visits from GA4 next to measured AI visibility. Pure; tested.
export type Ga4Row = { date: string; engine: string; sessions: number; engaged_sessions: number; key_events: number };
export type VisRow = { run_date: string; engine: string; answers: number; mentioned: number };

export const IMPACT_ENGINES = ["chatgpt", "gemini", "perplexity", "copilot", "claude", "other_ai"];
export const IMPACT_LABEL: Record<string, string> = { chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity", copilot: "Copilot", claude: "Claude", other_ai: "Other AI" };

export function weekOf(d: string): string {
  const dow = new Date(d + "T00:00:00Z").getUTCDay();
  return new Date(Date.parse(d + "T00:00:00Z") - ((dow + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
}

export function impactSummary(ga4: Ga4Row[], vis: VisRow[]) {
  const sum = (rs: Ga4Row[], k: "sessions" | "engaged_sessions" | "key_events") => rs.reduce((s, r) => s + Number(r[k] || 0), 0);
  const engines = IMPACT_ENGINES.filter((e) => ga4.some((r) => r.engine === e) || vis.some((v) => v.engine === e)).map((e) => {
    const g = ga4.filter((r) => r.engine === e), v = vis.filter((r) => r.engine === e);
    const answers = v.reduce((s, r) => s + r.answers, 0), named = v.reduce((s, r) => s + r.mentioned, 0);
    return { engine: e, visits: sum(g, "sessions"), engaged: sum(g, "engaged_sessions"), keyEvents: sum(g, "key_events"), visibility: answers ? { n: named, of: answers } : null };
  });
  const weeks = [...new Set([...ga4.map((r) => weekOf(r.date)), ...vis.map((v) => weekOf(v.run_date))])].sort().map((w) => {
    const g = ga4.filter((r) => weekOf(r.date) === w), v = vis.filter((r) => weekOf(r.run_date) === w);
    const answers = v.reduce((s, r) => s + r.answers, 0), named = v.reduce((s, r) => s + r.mentioned, 0);
    return { week: w, visits: sum(g, "sessions"), keyEvents: sum(g, "key_events"), visibility: answers ? { n: named, of: answers } : null };
  });
  return { visits: sum(ga4, "sessions"), engaged: sum(ga4, "engaged_sessions"), keyEvents: sum(ga4, "key_events"), engines, weeks };
}
