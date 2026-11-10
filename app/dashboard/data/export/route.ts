import { NextResponse } from "next/server";
import { getWorkspace } from "@/lib/workspace";

// DPDP Act — right to access: everything stored about this workspace that its members can see, as one JSON file.
export async function GET() {
  const { supabase, user, tenantId, brand } = await getWorkspace();
  const b = brand?.id;
  const q = async (table: string, cols: string, by: "tenant" | "brand" = "brand") => {
    if (by === "brand" && !b) return [];
    const { data } = await supabase.from(table).select(cols).eq(by === "brand" ? "brand_id" : "tenant_id", by === "brand" ? b! : tenantId).limit(5000);
    return data ?? [];
  };
  const out = {
    exported_at: new Date().toISOString(),
    you: { email: user.email },
    membership: await q("tenant_members", "role, created_at, email_daily, email_weekly, email_tips, last_seen_at, terms_version, terms_accepted_at", "tenant"),
    brand,
    competitors: await q("competitors", "name, domain, status, created_at"),
    questions: await q("prompts", "text, language, journey_phase, status, created_at"),
    recommendations: await q("recommendations", "title, body, category, status, created_at"),
    actions: await q("actions", "path, description, status, performed_at, url"),
    reports: await q("reports", "kind, period_start, period_end, summary, emailed_at"),
    integrations: await q("integrations", "provider, status"),
    subscriptions: await q("subscriptions", "plan, status, billing_interval, currency, current_period_end, created_at", "tenant"),
    invoices: await q("invoices", "number, amount_minor, gst_minor, currency, status, issued_at, paid_at", "tenant"),
    note: "AI answers and citations are business data about your market; download them from the Prompts and Citations tabs. Card details are held by Razorpay, not by us.",
  };
  return new NextResponse(JSON.stringify(out, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="truevisible-data-${new Date().toISOString().slice(0, 10)}.json"`, "cache-control": "no-store" } });
}
