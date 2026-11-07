import { test } from "node:test";
import assert from "node:assert/strict";
import { promptLimit, trialState } from "./plan";

const day = 86_400_000;
const sub = (o: object) => ({ plan: "trial", status: "trialing", trial_ends_at: null, trial_started_at: null, ...o });

test("question limits by plan", () => {
  assert.equal(promptLimit(sub({})), 10);                                                   // trial not started yet
  assert.equal(promptLimit(sub({ trial_ends_at: new Date(Date.now() - day).toISOString() })), 0);
  assert.equal(promptLimit(sub({ plan: "track", status: "active" })), 50);
  assert.equal(promptLimit(sub({ plan: "managed", status: "active" })), 50);
  assert.equal(promptLimit(sub({ plan: "managed_plus", status: "active" })), 100);
  assert.equal(promptLimit(sub({ plan: "internal", status: "active" })), 50);
  assert.equal(promptLimit(sub({ plan: "track", status: "cancelled" })), 0);
});

test("trial: not started until the first verified check; 7 days live; then ended", () => {
  assert.deepEqual(trialState(sub({})), { kind: "not_started" });
  assert.deepEqual(trialState(sub({ trial_started_at: new Date().toISOString(), trial_ends_at: new Date(Date.now() + 6.5 * day).toISOString() })), { kind: "live", daysLeft: 7 });
  assert.deepEqual(trialState(sub({ status: "expired" })), { kind: "ended" });
  assert.deepEqual(trialState(sub({ plan: "track", status: "active" })), { kind: "none" });
});
