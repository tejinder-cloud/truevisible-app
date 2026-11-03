// Overview metrics (plan Day 20). Pure functions over stored rows — every number on the Overview comes from here,
// so each one can be traced to answers in completed runs. No rows → null → "—" on screen, never a zero.

export type Engine = "chatgpt" | "gemini" | "perplexity" | "ai_overviews" | "copilot" | "meta_ai";
export const ENGINE_ORDER: Engine[] = ["chatgpt", "gemini", "perplexity", "ai_overviews", "copilot", "meta_ai"];
export const ENGINE_LABEL: Record<string, string> = {
  chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity", ai_overviews: "AI Overviews", copilot: "Copilot", meta_ai: "Meta AI",
};

export type DailyRow = { run_date: string; engine: string; answers: number; mentioned: number };
export type LatestAnswer = { engine: string; mentioned: boolean | null; competitors_mentioned: string[] | null; prompt_text: string };
export type DomainRow = { domain: string; channel_type: string | null; owned: boolean; citations: number; answers: number };

export type Ratio = { n: number; of: number; pct: number } | null;
const ratio = (n: number, of: number): Ratio => (of > 0 ? { n, of, pct: Math.round((n / of) * 100) } : null);

export function latestDate(rows: DailyRow[]): string | null {
  return rows.reduce<string | null>((max, r) => (!max || r.run_date > max ? r.run_date : max), null);
}

export function overallOn(rows: DailyRow[], date: string | null): Ratio {
  if (!date) return null;
  const day = rows.filter((r) => r.run_date === date);
  return ratio(day.reduce((s, r) => s + r.mentioned, 0), day.reduce((s, r) => s + r.answers, 0));
}

/** One point per engine per day it ran; engines in fixed order so colours never move. */
export function seriesByEngine(rows: DailyRow[]): { engine: string; points: { date: string; pct: number; n: number; of: number }[] }[] {
  const engines = ENGINE_ORDER.filter((e) => rows.some((r) => r.engine === e));
  return engines.map((engine) => ({
    engine,
    points: rows
      .filter((r) => r.engine === engine && r.answers > 0)
      .sort((a, b) => a.run_date.localeCompare(b.run_date))
      .map((r) => ({ date: r.run_date, pct: Math.round((r.mentioned / r.answers) * 100), n: r.mentioned, of: r.answers })),
  }));
}

/** Whole-word match, case-insensitive; names under 3 characters ignored (same rule as the tracker). */
export function containsName(text: string, names: string[]): boolean {
  const t = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  return names.some((raw) => {
    const n = raw.toLowerCase().trim();
    if (n.length < 3) return false;
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9\\u0900-\\u097F])${esc}(?=$|[^a-z0-9\\u0900-\\u097F])`).test(t);
  });
}

/**
 * A question that already contains the brand's name will almost always get the brand named back.
 * Splitting branded from unbranded questions shows whether AI recommends you when buyers don't ask for you.
 */
export function brandedSplit(latest: LatestAnswer[], brandNames: string[]): { branded: Ratio; unbranded: Ratio } {
  const b = latest.filter((a) => containsName(a.prompt_text, brandNames));
  const u = latest.filter((a) => !containsName(a.prompt_text, brandNames));
  return {
    branded: ratio(b.filter((a) => a.mentioned).length, b.length),
    unbranded: ratio(u.filter((a) => a.mentioned).length, u.length),
  };
}

/** Share of voice on the latest day: answers naming the brand vs answers naming each tracked competitor. */
export function shareOfVoice(latest: LatestAnswer[], competitors: string[]): { name: string; answers: number; share: number; isBrand: boolean }[] | null {
  if (!latest.length || !competitors.length) return null;
  const brand = latest.filter((a) => a.mentioned).length;
  const comps = competitors.map((c) => ({ name: c, answers: latest.filter((a) => (a.competitors_mentioned ?? []).includes(c)).length }));
  const total = brand + comps.reduce((s, c) => s + c.answers, 0);
  if (total === 0) return comps.length ? [{ name: "", answers: 0, share: 0, isBrand: true }, ...comps.map((c) => ({ ...c, share: 0, isBrand: false }))] : null;
  const rows = [{ name: "", answers: brand, isBrand: true }, ...comps.map((c) => ({ ...c, isBrand: false }))];
  return rows.map((r) => ({ ...r, share: Math.round((r.answers / total) * 100) })).sort((a, b) => Number(b.isBrand) - Number(a.isBrand) || b.answers - a.answers);
}

export function topSources(domains: DomainRow[], limit = 6): { rows: DomainRow[]; total: number; ownedAnswers: number } {
  const rows = [...domains].sort((a, b) => b.answers - a.answers || b.citations - a.citations || a.domain.localeCompare(b.domain)).slice(0, limit);
  return { rows, total: domains.length, ownedAnswers: domains.filter((d) => d.owned).reduce((s, d) => s + d.answers, 0) };
}

export const CHANNEL_LABEL: Record<string, string> = {
  owned: "Your site", earned: "Earned", social: "Social", directory: "Directory", marketplace: "Marketplace",
  news: "News", reference: "Reference", forum: "Forum", video: "Video", other: "Other",
};
