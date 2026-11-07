import { test } from "node:test";
import assert from "node:assert/strict";
import { changePackFilename, changePackMarkdown, inChangePack, pathFor } from "./execution";

test("every platform has a plain-words path; unknown falls back to custom", () => {
  assert.equal(pathFor("wordpress").connect, "wordpress");
  assert.equal(pathFor("shopify").connect, undefined);
  assert.equal(pathFor(null).label, "Custom site");
});

test("change pack holds open and doing on-site items only", () => {
  assert.equal(inChangePack({ category: "onsite", status: "open" }), true);
  assert.equal(inChangePack({ category: "technical", status: "diy" }), true);
  assert.equal(inChangePack({ category: "offsite", status: "open" }), false);
  assert.equal(inChangePack({ category: "content", status: "done" }), false);
});

test("change pack markdown: numbered, code fenced, platform hint, empty state", () => {
  const md = changePackMarkdown({ brand: "The Growth Lab", domain: "thegrowthlab.co.in", platform: "wix", date: "2026-11-07", items: [
    { rec: { id: "a", title: "Add Organization schema", body: "So AI knows who you are.", category: "technical", impact: 4, ease: 4 }, asset: { kind: "json_ld", title: "Organization", content: { format: "json", body: '{"@type":"Organization"}' } } },
    { rec: { id: "b", title: "Publish an FAQ", body: null, category: "content", impact: 3, ease: 3 }, asset: { kind: "faq_block", title: "FAQ", content: { format: "markdown", body: "**Q?** A." } } },
  ] });
  assert.match(md, /^# Change pack — The Growth Lab/);
  assert.match(md, /## 1\. Add Organization schema/);
  assert.match(md, /```json\n\{"@type":"Organization"\}\n```/);
  assert.match(md, /Advanced SEO → Structured data markup/);
  assert.match(md, /## 2\. Publish an FAQ[\s\S]*\*\*Q\?\*\* A\./);
  assert.match(changePackMarkdown({ brand: "X", domain: null, platform: null, date: "d", items: [] }), /No on-site changes/);
  assert.equal(changePackFilename("The Growth Lab", "2026-11-07"), "the-growth-lab-change-pack-2026-11-07.md");
});
