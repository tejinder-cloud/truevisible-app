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

import { canPublish, publishAs, wpState } from "./execution";
test("publishing is for TGL and managed plans; WordPress states read plainly", () => {
  assert.equal(canPublish("internal"), true);
  assert.equal(canPublish("managed_plus"), true);
  assert.equal(canPublish("track"), false);
  assert.equal(canPublish("trial"), false);
  assert.equal(wpState(undefined).key, "none");
  assert.equal(wpState({ id: "a", status: "planned", url: null, detail: { step: "draft" } }).key, "drafting");
  assert.equal(wpState({ id: "a", status: "in_progress", url: "u", detail: { step: "awaiting_approval", placeholders: [] } }).key, "review");
  const b = wpState({ id: "a", status: "in_progress", url: "u", detail: { step: "awaiting_approval", placeholders: ["[add x]", "[confirm y]"] } });
  assert.equal(b.key, "blocked"); assert.match(b.text, /2 things to fill in.*\[add x\], \[confirm y\]/);
  assert.equal(wpState({ id: "a", status: "planned", url: "u", detail: { step: "publish" } }).key, "publishing");
  assert.equal(wpState({ id: "a", status: "done", url: "u", detail: {} }).key, "live");
  assert.match(wpState({ id: "a", status: "failed", url: null, detail: { error: "tool needs content" } }).text, /tool needs content/);
});

test("page or blog post default", () => {
  assert.equal(publishAs({ title: "/what-is-aeo-geo-ai-visibility-india", body: "# What is AEO and why does your business need AI visibility?" }), "post");
  assert.equal(publishAs({ title: "/ai-automation-whatsapp-crm-lead-scoring", body: "# AI automation for leads: WhatsApp, CRM and lead scoring" }), "page");
  assert.equal(publishAs({ title: "/case-studies hub (summary page)", body: "# Case studies" }), "page");
  assert.match(wpState({ id: "a", status: "done", url: "u", detail: { wp_type: "post" } }).text, /blog post/);
});

test("meta states", () => {
  const ch = [{ label: "Homepage", page_id: 1, page_title: "Home", link: "u", field: "title" as const, old: null, new: "T" }, { label: "Homepage", page_id: 1, page_title: "Home", link: "u", field: "description" as const, old: "a", new: "b" }];
  assert.match(wpState({ id: "a", status: "in_progress", url: null, detail: { wp_type: "meta", step: "awaiting_approval", changes: ch } }).text, /2 changes on 1 page/);
  assert.equal(wpState({ id: "a", status: "done", url: null, detail: { wp_type: "meta", changes: ch } }).key, "live");
});

import { itemState, planWeek, stripRefs } from "./aeo-plan";
test("plan week and item states", () => {
  assert.equal(planWeek("2026-11-10", "2026-11-09"), 0);
  assert.equal(planWeek("2026-11-10", "2026-11-10"), 1);
  assert.equal(planWeek("2026-11-10", "2026-11-17"), 2);
  assert.equal(planWeek("2026-11-10", "2027-03-01"), 14);
  const it = (week: number, rec: string | null = null) => ({ id: "x", week, title: "t", detail: "", kind: "page", path: "wordpress", count: 1, recommendation_id: rec });
  const rs = new Map([["r-done", "done"], ["r-open", "open"]]);
  assert.equal(itemState(it(3, "r-done"), 1, rs, new Set()), "done");
  assert.equal(itemState(it(3, "r-open"), 1, rs, new Set(["r-open"])), "in_progress");
  assert.equal(itemState(it(2), 2, rs, new Set()), "this_week");
  assert.equal(itemState(it(1), 2, rs, new Set()), "overdue");
  assert.equal(itemState(it(5), 2, rs, new Set()), "planned");
});

test("plan text: internal codes stripped", () => {
  assert.equal(stripRefs("Use the same names everywhere (S1, S4, S6). This is aimed at P2."), "Use the same names everywhere.");
  assert.equal(stripRefs("Hospitals in PS2 and Rs 3999"), "Hospitals in PS2 and Rs 3999");
});
