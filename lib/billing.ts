// Track self-serve billing (plan Day 26; prices per decision 7 Nov 2026, ex-GST; international under LUT, no GST).
// Razorpay Subscriptions: plans are found by name or created on first use; amounts charged include GST for India.

export type Interval = "month" | "year";
export type Currency = "INR" | "USD";
export const TRACK_PRICE: Record<Currency, Record<Interval, number>> = {   // minor units, ex-GST
  INR: { month: 399_900, year: 3_999_000 },
  USD: { month: 4_900, year: 49_000 },
};
export const GST_RATE: Record<Currency, number> = { INR: 18, USD: 0 };

export function chargeMinor(currency: Currency, interval: Interval): { price: number; gst: number; total: number } {
  const price = TRACK_PRICE[currency][interval];
  const gst = Math.round((price * GST_RATE[currency]) / 100);
  return { price, gst, total: price + gst };
}

export function formatMoney(minor: number, currency: Currency): string {
  return currency === "INR" ? `₹${(minor / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : `$${(minor / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** GSTIN: 2-digit state code + 13 characters (format check only). */
export const validGstin = (g: string) => /^[0-9]{2}[A-Z0-9]{13}$/.test(g.trim().toUpperCase());

export const planName = (currency: Currency, interval: Interval) => `TrueVisible Track · ${currency} · ${interval === "year" ? "annual" : "monthly"}`;

export function razorpayConfigured(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim());
}

async function rzp(path: string, init: RequestInit = {}, fetchImpl: typeof fetch = fetch): Promise<any> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID!.trim()}:${process.env.RAZORPAY_KEY_SECRET!.trim()}`).toString("base64");
  const res = await fetchImpl(`https://api.razorpay.com/v1${path}`, { ...init, headers: { authorization: `Basic ${auth}`, "content-type": "application/json", ...(init.headers ?? {}) } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Razorpay ${path}: ${j?.error?.description ?? res.status}`);
  return j;
}

const planCache = new Map<string, string>();
export async function ensurePlan(currency: Currency, interval: Interval, fetchImpl: typeof fetch = fetch): Promise<string> {
  const name = planName(currency, interval);
  const { total } = chargeMinor(currency, interval);
  const key = `${name}|${total}`;
  if (planCache.has(key)) return planCache.get(key)!;
  const list = await rzp("/plans?count=100", {}, fetchImpl);
  const found = (list.items ?? []).find((p: any) => p.item?.name === name && p.item?.amount === total && p.item?.currency === currency);
  const id = found?.id ?? (await rzp("/plans", { method: "POST", body: JSON.stringify({
    period: interval === "year" ? "yearly" : "monthly", interval: 1,
    item: { name, amount: total, currency, description: currency === "INR" ? "Includes 18% GST" : "Export of services under LUT — no GST" },
  }) }, fetchImpl)).id;
  planCache.set(key, id);
  return id;
}

export async function createSubscription(p: { currency: Currency; interval: Interval; tenantId: string; email: string; gstin?: string; legalName?: string }, fetchImpl: typeof fetch = fetch): Promise<string> {
  const plan_id = await ensurePlan(p.currency, p.interval, fetchImpl);
  const sub = await rzp("/subscriptions", { method: "POST", body: JSON.stringify({
    plan_id, total_count: p.interval === "year" ? 10 : 120, customer_notify: 1,
    notes: { product: "truevisible", plan: "track", tenant_id: p.tenantId, email: p.email, gstin: p.gstin ?? "", legal_name: p.legalName ?? "" },
  }) }, fetchImpl);
  return sub.id as string;
}

export async function cancelAtCycleEnd(subscriptionId: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  await rzp(`/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { method: "POST", body: JSON.stringify({ cancel_at_cycle_end: 1 }) }, fetchImpl);
}
