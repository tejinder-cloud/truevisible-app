import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPromptRows, citationGap, dayRange, gapAction, type HistoryRow } from "./tabs";

const h = (o: Partial<HistoryRow>): HistoryRow => ({ id: "a", prompt_id: "p1", engine: "chatgpt", run_date: "2026-11-04", created_at: "2026-11-04T01:00:00Z", mentioned: false, position: null, competitors_mentioned: [], ...o });

test("dayRange is inclusive", () => {
  assert.deepEqual(dayRange("2026-10-30", "2026-11-02"), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
});

test("prompt rows: latest per engine, daily + audit on one day keeps the later, history has gaps as null, unbranded first", () => {
  const prompts = [
    { id: "p1", text: "Is The Growth Lab good?", language: "en", journey_phase: "decision" },
    { id: "p2", text: "Best AEO agency India", language: "en", journey_phase: "consideration" },
  ];
  const hist = [
    h({ id: "a1", prompt_id: "p1", run_date: "2026-11-03", mentioned: true, position: 1 }),
    h({ id: "a2", prompt_id: "p2", run_date: "2026-11-04", created_at: "2026-11-04T00:30:00Z", mentioned: false, competitors_mentioned: ["Wevia"] }),
    h({ id: "a3", prompt_id: "p2", run_date: "2026-11-04", created_at: "2026-11-04T08:30:00Z", mentioned: true, position: 3 }),
    h({ id: "a4", prompt_id: "p2", engine: "perplexity", run_date: "2026-11-04", competitors_mentioned: ["Dovetail Solutions"] }),
  ];
  const { rows, engines } = buildPromptRows(prompts, hist, ["2026-11-03", "2026-11-04"], (t) => t.includes("Growth Lab"));
  assert.deepEqual(engines, ["chatgpt", "perplexity"]);
  assert.equal(rows[0].id, "p2"); // unbranded first
  assert.equal(rows[0].latest.chatgpt?.answerId, "a3");
  assert.equal(rows[0].latest.chatgpt?.position, 3);
  assert.deepEqual(rows[0].history.chatgpt, [null, true]);
  assert.deepEqual(rows[0].competitors, ["Dovetail Solutions"]);
  assert.equal(rows[0].namedAnywhere, true);
  assert.equal(rows[1].latest.perplexity, null);          // never asked on Perplexity → "—", not "not named"
  assert.deepEqual(rows[1].history.chatgpt, [true, null]);
  assert.equal(rows[1].branded, true);
});

test("citation gap: owned and fully-covered sites excluded; competitor-named first", () => {
  const s = (domain: string, o: object) => ({ domain, channel_type: null, owned: false, answers: 5, named_you: 0, without_you: 5, competitor_not_you: 0, competitors: [], ...o });
  const gap = citationGap([
    s("mine.in", { owned: true }), s("a.com", { without_you: 6 }), s("b.com", { without_you: 2, competitor_not_you: 2, competitors: ["Wevia"] }), s("c.com", { without_you: 0, named_you: 5 }),
  ]);
  assert.deepEqual(gap.map((g) => g.domain), ["b.com", "a.com"]);
  assert.match(gapAction("directory"), /listed/);
  assert.match(gapAction(null), /Open it/);
  assert.match(gapAction(null, "agencies.semrush.com"), /listed/);
});
