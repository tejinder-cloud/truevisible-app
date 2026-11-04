// Prompts and Citations tabs (plan Day 21). Pure functions over stored rows: every number shown is a count of
// answers from completed runs; no row → null → "—" on screen.
import { ENGINE_ORDER } from "@/lib/overview";

export type HistoryRow = { id: string; prompt_id: string; engine: string; run_date: string; created_at: string; mentioned: boolean | null; position: number | null; competitors_mentioned: string[] | null };
export type Cell = { answerId: string; date: string; mentioned: boolean; position: number | null; competitors: string[] };
export type PromptRow = {
  id: string; text: string; language: string; stage: string; branded: boolean;
  latest: Record<string, Cell | null>;             // engine → most recent answer
  history: Record<string, (boolean | null)[]>;      // engine → one entry per day in `days` (null = not asked that day)
  competitors: string[];                            // named in the latest answers, any engine
  namedAnywhere: boolean | null;                    // latest answers: any engine named you (null = never asked)
};

/** Calendar days from `from` to `to` inclusive (YYYY-MM-DD). */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = new Date(from + "T00:00:00Z"); d <= new Date(to + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

export function buildPromptRows(
  prompts: { id: string; text: string; language: string; journey_phase: string }[],
  history: HistoryRow[], days: string[], isBranded: (text: string) => boolean,
): { rows: PromptRow[]; engines: string[] } {
  const engines = ENGINE_ORDER.filter((e) => history.some((h) => h.engine === e));
  // Latest answer per prompt × engine × day (a day can have a daily run and an audit).
  const byKey = new Map<string, HistoryRow>();
  for (const h of history) {
    const k = `${h.prompt_id}|${h.engine}|${h.run_date}`;
    const prev = byKey.get(k);
    if (!prev || h.created_at > prev.created_at) byKey.set(k, h);
  }
  const rows = prompts.map((p) => {
    const latest: Record<string, Cell | null> = {};
    const hist: Record<string, (boolean | null)[]> = {};
    for (const e of engines) {
      hist[e] = days.map((d) => { const h = byKey.get(`${p.id}|${e}|${d}`); return h ? !!h.mentioned : null; });
      const lastDay = [...days].reverse().find((d) => byKey.has(`${p.id}|${e}|${d}`));
      const h = lastDay ? byKey.get(`${p.id}|${e}|${lastDay}`)! : null;
      latest[e] = h ? { answerId: h.id, date: h.run_date, mentioned: !!h.mentioned, position: h.position, competitors: h.competitors_mentioned ?? [] } : null;
    }
    const cells = Object.values(latest).filter(Boolean) as Cell[];
    return {
      id: p.id, text: p.text, language: p.language, stage: p.journey_phase, branded: isBranded(p.text),
      latest, history: hist,
      competitors: [...new Set(cells.flatMap((c) => c.competitors))].sort(),
      namedAnywhere: cells.length ? cells.some((c) => c.mentioned) : null,
    };
  });
  // Unbranded first (they show whether AI recommends you unprompted), then by buyer stage, keeping setup order.
  const stageOrder: Record<string, number> = { awareness: 0, consideration: 1, decision: 2 };
  rows.sort((a, b) => Number(a.branded) - Number(b.branded) || (stageOrder[a.stage] ?? 9) - (stageOrder[b.stage] ?? 9));
  return { rows, engines };
}

export type SiteRow = { domain: string; channel_type: string | null; owned: boolean; answers: number; named_you: number; without_you: number; competitor_not_you: number; competitors: string[] };

/** Citation gap: sites AI cites in answers that don't name you — first those where it names a competitor instead. */
export function citationGap(sites: SiteRow[], limit = 12): SiteRow[] {
  return sites
    .filter((s) => !s.owned && s.without_you > 0)
    .sort((a, b) => b.competitor_not_you - a.competitor_not_you || b.without_you - a.without_you || a.domain.localeCompare(b.domain))
    .slice(0, limit);
}

/** What to do about a cited site, by what kind of site it is. Advice, not a measurement — no numbers here. */
const LISTING_SITES = /(^|\.)(semrush\.com|sortlist\.(com|in)|clutch\.co|goodfirms\.co|designrush\.com|justdial\.com|sulekha\.com|indiamart\.com|trustpilot\.com|g2\.com|pickanagency\.com|upcity\.com|themanifest\.com|yelp\.com|tripadvisor\.[a-z.]+|practo\.com|99acres\.com|magicbricks\.com|shiksha\.com|collegedunia\.com)$/;

export function gapAction(channel: string | null, domain = ""): string {
  if (!channel && LISTING_SITES.test(domain)) channel = "directory";
  switch (channel) {
    case "directory": return "Get listed and complete your profile — services, city, photos, reviews.";
    case "marketplace": return "List your service with full details and pricing.";
    case "forum": return "Join the discussion with a genuinely useful answer.";
    case "social": return "Post and take part where these conversations happen.";
    case "news": case "earned": return "Pitch a story or an expert quote to this publication.";
    case "reference": return "Check what this page says about your field — and that you're included.";
    case "video": return "Publish a short explainer video on the same question.";
    default: return "Open it and see how businesses get included — a listing, a guest post or a review.";
  }
}
