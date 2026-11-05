import { test } from "node:test";
import assert from "node:assert/strict";
import { impactSummary, weekOf } from "./impact";

test("impact: totals, per engine with visibility next to visits, weeks starting Monday", () => {
  assert.equal(weekOf("2026-11-05"), "2026-11-02");
  const s = impactSummary(
    [{ date: "2026-11-03", engine: "chatgpt", sessions: 5, engaged_sessions: 3, key_events: 1 }, { date: "2026-11-10", engine: "perplexity", sessions: 2, engaged_sessions: 2, key_events: 0 }],
    [{ run_date: "2026-11-03", engine: "chatgpt", answers: 16, mentioned: 2 }, { run_date: "2026-11-03", engine: "gemini", answers: 16, mentioned: 2 }],
  );
  assert.deepEqual([s.visits, s.engaged, s.keyEvents], [7, 5, 1]);
  assert.deepEqual(s.engines.map((e) => [e.engine, e.visits, e.visibility]), [["chatgpt", 5, { n: 2, of: 16 }], ["gemini", 0, { n: 2, of: 16 }], ["perplexity", 2, null]]);
  assert.deepEqual(s.weeks.map((w) => [w.week, w.visits, w.visibility]), [["2026-11-02", 5, { n: 4, of: 32 }], ["2026-11-09", 2, null]]);
});
