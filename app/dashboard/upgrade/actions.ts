"use server";
import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/workspace";
import { cancelAtCycleEnd, chargeMinor, createSubscription, GST_RATE, razorpayConfigured, validGstin, type Currency, type Interval } from "@/lib/billing";

export type StartResult = { ok: true; subscriptionId: string; keyId: string; amount: number; currency: Currency; email: string; name: string } | { ok: false; error: string };

export async function startTrackCheckout(input: { currency: Currency; interval: Interval; gstin?: string; legalName?: string; state?: string }): Promise<StartResult> {
  const { supabase, user, tenantId, brand } = await getWorkspace();
  if (!razorpayConfigured()) return { ok: false, error: "Online payment isn't switched on yet." };
  const currency: Currency = input.currency === "USD" ? "USD" : "INR";
  const interval: Interval = input.interval === "year" ? "year" : "month";
  const gstin = (input.gstin ?? "").trim().toUpperCase();
  if (currency === "INR" && gstin && !validGstin(gstin)) return { ok: false, error: "That GSTIN doesn't look right — 15 characters, starting with your 2-digit state code." };
  if (currency === "USD" && !process.env.LEGAL_LUT_ARN?.trim()) return { ok: false, error: "Payment in dollars isn't available yet." };
  const state = currency === "INR" ? (gstin ? gstin.slice(0, 2) : String(input.state ?? "")) : "";
  if (currency === "INR" && !/^[0-9]{2}$/.test(state)) return { ok: false, error: "Pick your state — it decides the GST on your invoice." };
  try {
    const subscriptionId = await createSubscription({ currency, interval, tenantId: tenantId!, email: user.email ?? "", gstin: currency === "INR" ? gstin : "", legalName: input.legalName?.trim() });
    const { price, total } = chargeMinor(currency, interval);
    const { error } = await supabase.rpc("tv_billing_checkout_created", { p_subscription_id: subscriptionId, p_interval: interval, p_currency: currency, p_price_minor: price,
      p_gst_rate: GST_RATE[currency], p_gstin: currency === "INR" ? gstin : "", p_legal_name: input.legalName?.trim() ?? "", p_state: state || null });
    if (error) return { ok: false, error: error.message.includes("owner") ? "Only the workspace owner can upgrade." : "Couldn't start the payment. Please try again." };
    return { ok: true, subscriptionId, keyId: process.env.RAZORPAY_KEY_ID!.trim(), amount: total, currency, email: user.email ?? "", name: brand?.name ?? "TrueVisible" };
  } catch {
    return { ok: false, error: "Couldn't reach the payment provider. Please try again in a minute." };
  }
}

export async function confirmTrackCheckout(p: { subscriptionId: string; paymentId: string; signature: string }): Promise<{ ok: boolean }> {
  const { supabase } = await getWorkspace();
  const { data, error } = await supabase.rpc("tv_billing_confirm", { p_subscription_id: p.subscriptionId, p_payment_id: p.paymentId, p_signature: p.signature });
  revalidatePath("/dashboard", "layout");
  return { ok: !error && data === true };
}

export async function cancelTrack() {
  const { supabase, tenantId } = await getWorkspace();
  const { data: sub } = await supabase.from("subscriptions").select("razorpay_subscription_id").eq("tenant_id", tenantId!).eq("product", "truevisible").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (sub?.razorpay_subscription_id && razorpayConfigured()) await cancelAtCycleEnd(sub.razorpay_subscription_id).catch(() => {});
  revalidatePath("/dashboard/settings");
}
