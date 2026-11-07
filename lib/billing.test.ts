import { test } from "node:test";
import assert from "node:assert/strict";
import { chargeMinor, createSubscription, ensurePlan, formatMoney, validGstin } from "./billing";

test("Track prices: ex-GST per decision; India adds 18% GST, international none", () => {
  assert.deepEqual(chargeMinor("INR", "month"), { price: 399_900, gst: 71_982, total: 471_882 });
  assert.deepEqual(chargeMinor("INR", "year"), { price: 3_999_000, gst: 719_820, total: 4_718_820 });
  assert.deepEqual(chargeMinor("USD", "month"), { price: 4_900, gst: 0, total: 4_900 });
  assert.equal(formatMoney(399_900, "INR"), "₹3,999");
  assert.equal(formatMoney(49_000, "USD"), "$490");
  assert.equal(validGstin("03ABCDE1234F1Z5"), true);
  assert.equal(validGstin("ABC"), false);
});

test("Razorpay: reuses a plan with the same name and amount, else creates it; subscription carries tenant notes", async () => {
  process.env.RAZORPAY_KEY_ID = "rzp_test_x"; process.env.RAZORPAY_KEY_SECRET = "s";
  const calls: { url: string; body?: any }[] = [];
  const f: any = async (url: string, init: any) => {
    calls.push({ url, body: init.body ? JSON.parse(init.body) : undefined });
    if (url.endsWith("/plans?count=100")) return new Response(JSON.stringify({ items: [] }), { status: 200 });
    if (url.endsWith("/plans")) return new Response(JSON.stringify({ id: "plan_1" }), { status: 200 });
    return new Response(JSON.stringify({ id: "sub_1" }), { status: 200 });
  };
  const id = await createSubscription({ currency: "INR", interval: "month", tenantId: "t1", email: "a@b.c", gstin: "03ABCDE1234F1Z5" }, f);
  assert.equal(id, "sub_1");
  assert.equal(calls[1].body.item.amount, 471_882);
  assert.equal(calls[1].body.period, "monthly");
  assert.equal(calls[2].body.plan_id, "plan_1");
  assert.equal(calls[2].body.notes.tenant_id, "t1");
  assert.equal(await ensurePlan("INR", "month", f), "plan_1");          // cached
  assert.equal(calls.length, 3);
  assert.ok(calls[0].url.startsWith("https://api.razorpay.com/v1/"));
});
