import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// "Start managed AEO": record the click (our team follows up in #doors-aeo), then send the customer to the
// AEO page on thegrowthlab.co.in, where the offer and pricing live. Never blocks the redirect on the record.
const AEO_PAGE = process.env.NEXT_PUBLIC_MANAGED_AEO_URL || "https://thegrowthlab.co.in/answer-engine-optimization-services/";

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const target = new URL(AEO_PAGE);
  target.searchParams.set("utm_source", "truevisible");
  target.searchParams.set("utm_medium", "dashboard");
  target.searchParams.set("utm_campaign", "managed_aeo");
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: member } = await supabase.from("tenant_members").select("tenant_id").eq("user_id", user.id).order("created_at").limit(1).maybeSingle();
      const { data: brand } = member ? await supabase.from("brands").select("id").eq("tenant_id", member.tenant_id).order("created_at").limit(1).maybeSingle() : { data: null };
      if (brand) await supabase.rpc("tv_request_managed_aeo", { p_brand: brand.id, p_recommendation: from && /^[0-9a-f-]{36}$/i.test(from) ? from : null, p_note: "Clicked Start managed AEO in the dashboard" });
    }
  } catch { /* the customer still gets to the page */ }
  return NextResponse.redirect(target, 303);
}
