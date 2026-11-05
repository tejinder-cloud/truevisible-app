import { test } from "node:test";
import assert from "node:assert/strict";
import { emailFromIdToken, ga4AuthUrl, parseAccountSummaries } from "./ga4";

test("GA4 auth URL: read-only analytics scope, offline access, consent, state", () => {
  process.env.GOOGLE_CLIENT_ID = "cid";
  const u = new URL(ga4AuthUrl("https://app.x/dashboard/integrations/ga4/callback", "st8"));
  assert.equal(u.searchParams.get("scope"), "openid email https://www.googleapis.com/auth/analytics.readonly");
  assert.equal(u.searchParams.get("access_type"), "offline");
  assert.equal(u.searchParams.get("prompt"), "consent");
  assert.equal(u.searchParams.get("state"), "st8");
});

test("account summaries → property list; id_token email", () => {
  assert.deepEqual(parseAccountSummaries({ accountSummaries: [{ displayName: "TGL", propertySummaries: [{ property: "properties/123", displayName: "thegrowthlab.co.in" }, { property: "bad" }] }] }),
    [{ id: "properties/123", name: "thegrowthlab.co.in", account: "TGL" }]);
  assert.deepEqual(parseAccountSummaries({}), []);
  const tok = ["x", Buffer.from(JSON.stringify({ email: "a@b.c" })).toString("base64url"), "y"].join(".");
  assert.equal(emailFromIdToken(tok), "a@b.c");
  assert.equal(emailFromIdToken(undefined), null);
});
