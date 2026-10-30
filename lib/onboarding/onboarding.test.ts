import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDomain, splitList } from "./domain";
import { suggestVariants } from "./variants";
import { draftPrompts } from "./prompts";

test("normalizeDomain", () => {
  assert.equal(normalizeDomain("https://www.TheGrowthLab.co.in/about?x=1"), "thegrowthlab.co.in");
  assert.equal(normalizeDomain("example.com:8080/"), "example.com");
  assert.equal(normalizeDomain("not a domain"), null);
  assert.equal(normalizeDomain(""), null);
});

test("splitList dedupes case-insensitively and caps", () => {
  assert.deepEqual(splitList("A, b\n a ,, c"), ["A", "b", "c"]);
  assert.equal(splitList("1,2,3,4", 2).length, 2);
});

test("suggestVariants", () => {
  const v = suggestVariants("The Growth Lab", "https://thegrowthlab.co.in");
  assert.ok(v.includes("Growth Lab"));
  assert.ok(v.includes("GrowthLab"));
  assert.ok(v.includes("GL"));
  assert.ok(v.includes("thegrowthlab.co.in"));
  assert.ok(!v.includes("The Growth Lab"));
});

test("draftPrompts respects limit and covers each language", () => {
  const ctx = { brand: "Navkiran", product: "nursing coaching", icp: "nursing aspirants", location: "Mohali", competitor: "ABC Academy" };
  const p = draftPrompts(ctx, ["en", "hi", "hinglish"], 10);
  assert.equal(p.length, 10);
  for (const lang of ["en", "hi", "hinglish"]) assert.ok(p.some((x) => x.language === lang), lang);
  assert.equal(new Set(p.map((x) => x.text)).size, 10);
  assert.ok(p.every((x) => ["awareness", "consideration", "decision"].includes(x.journey_phase)));
  assert.equal(draftPrompts({ ...ctx, competitor: undefined }, ["en"], 50).length, 7);
});
