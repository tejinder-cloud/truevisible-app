// Competitors tab (plan Day 30). Pure helpers over the stored report: every number is a count from stored answers.
export type Rival = { name: string; tracked: boolean; answers: number; winsOverYou: number; engines: string[]; questions: { prompt: string; answers: number }[]; sites: { domain: string; answers: number }[] };
export type Playbook = { rival: string; why: { text: string; refs: string[] }[]; moves: string[] };

/** "Q2" → that rival's 2nd question, "S1" → its 1st site; unknown refs are dropped. */
export function refLabel(ref: string, r: Rival): string | null {
  const m = /^([QSE])(\d+)$/.exec(ref);
  if (!m) return null;
  const i = Number(m[2]) - 1;
  if (m[1] === "Q") return r.questions[i] ? `“${r.questions[i].prompt}”` : null;
  if (m[1] === "S") return r.sites[i]?.domain ?? null;
  return "an answer naming them";
}

/** Change in "named where you aren't" since the previous report; null when the rival wasn't in it. */
export function winsChange(r: Rival, prev: Rival[] | null): number | null {
  const p = prev?.find((x) => x.name.toLowerCase() === r.name.toLowerCase());
  return p ? r.winsOverYou - p.winsOverYou : null;
}

/** Same rule as tgl-ops stripCodes: evidence codes (Q3, S1, E2) never show to the client. */
export function stripCodes(t: string): string {
  return t
    .replace(/\s*\((?:\s*[QSE]\d{1,2}\s*(?:[,/&]|and)?\s*)+\)/g, "")
    .replace(/\b[QSE]\d{1,2}(?:\s*(?:,|and|&|\/)\s*[QSE]\d{1,2})*\b/g, "")
    .replace(/[,;]\s*\)/g, ")").replace(/\(\s*\)/g, "").replace(/\s+([,.;:])/g, "$1").replace(/\.(\s*\.)+/g, ".").replace(/\s{2,}/g, " ").trim();
}
