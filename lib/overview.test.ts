import { test } from "node:test";
import assert from "node:assert/strict";
import { brandedSplit, containsName, latestDate, overallOn, seriesByEngine, shareOfVoice, topSources, type DailyRow, type LatestAnswer } from "./overview";

// Shape of The Growth Lab's real data, 31 Oct – 3 Nov 2026: 10 prompts × 3 engines, named in the 2 branded prompts each day.
const daily: DailyRow[] = ["2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"].flatMap((d) =>
  ["perplexity", "chatgpt", "gemini"].map((engine) => ({ run_date: d, engine, answers: 10, mentioned: 2 })));
const prompts = ["Is The Growth Lab a good choice for performance marketing?", "The Growth Lab ka performance marketing kaisa hai?",
  ...Array.from({ length: 8 }, (_, i) => `best performance marketing agency chandigarh ${i}`)];
const latest: LatestAnswer[] = ["chatgpt", "gemini", "perplexity"].flatMap((engine) =>
  prompts.map((p, i) => ({ engine, prompt_text: p, mentioned: i < 2, competitors_mentioned: i === 3 ? ["Baclinc"] : [] })));

test("no runs → nulls, never zeros", () => {
  assert.equal(latestDate([]), null);
  assert.equal(overallOn([], null), null);
  assert.deepEqual(brandedSplit([], ["The Growth Lab"]), { branded: null, unbranded: null });
  assert.equal(shareOfVoice([], ["X"]), null);
});

test("overall visibility on the latest day = mentioned answers / all answers", () => {
  assert.equal(latestDate(daily), "2026-11-03");
  assert.deepEqual(overallOn(daily, "2026-11-03"), { n: 6, of: 30, pct: 20 });
});

test("series in fixed engine order regardless of row order", () => {
  const s = seriesByEngine(daily);
  assert.deepEqual(s.map((x) => x.engine), ["chatgpt", "gemini", "perplexity"]);
  assert.equal(s[0].points.length, 4);
  assert.deepEqual(s[0].points[3], { date: "2026-11-03", pct: 20, n: 2, of: 10 });
});

test("branded vs unbranded: TGL is named only when the question names TGL", () => {
  const r = brandedSplit(latest, ["The Growth Lab", "Growth Lab"]);
  assert.deepEqual(r.branded, { n: 6, of: 6, pct: 100 });
  assert.deepEqual(r.unbranded, { n: 0, of: 24, pct: 0 });
  assert.equal(containsName("The Growth Laboratory", ["Growth Lab"]), false);
  assert.equal(containsName("GL is great", ["GL"]), false);
});

test("share of voice: brand first, then competitors by mentions; null without competitors", () => {
  assert.equal(shareOfVoice(latest, []), null);
  const sov = shareOfVoice(latest, ["Baclinc", "Qaushik"])!;
  assert.deepEqual(sov.map((r) => [r.isBrand, r.name, r.answers, r.share]), [[true, "", 6, 67], [false, "Baclinc", 3, 33], [false, "Qaushik", 0, 0]]);
});

test("top sources by answers citing them, counts owned answers", () => {
  const t = topSources([
    { domain: "justdial.com", channel_type: "directory", owned: false, citations: 10, answers: 8 },
    { domain: "agencies.semrush.com", channel_type: null, owned: false, citations: 16, answers: 5 },
    { domain: "thegrowthlab.co.in", channel_type: "owned", owned: true, citations: 2, answers: 2 },
  ], 2);
  assert.deepEqual(t.rows.map((r) => r.domain), ["justdial.com", "agencies.semrush.com"]);
  assert.equal(t.total, 3);
  assert.equal(t.ownedAnswers, 2);
});
