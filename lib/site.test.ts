import { test } from "node:test";
import assert from "node:assert/strict";
import { siteUrl } from "./site";

test("siteUrl normalises scheme and trailing slash", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "truevisible-app-production.up.railway.app/";
  assert.equal(siteUrl(), "https://truevisible-app-production.up.railway.app");
  process.env.NEXT_PUBLIC_SITE_URL = "https://x.up.railway.app";
  assert.equal(siteUrl(), "https://x.up.railway.app");
  process.env.NEXT_PUBLIC_SITE_URL = "localhost:3000";
  assert.equal(siteUrl(), "http://localhost:3000");
  process.env.NEXT_PUBLIC_SITE_URL = "";
  assert.equal(siteUrl("https://fallback.app"), "https://fallback.app");
});
