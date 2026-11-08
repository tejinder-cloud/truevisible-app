import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Brand = {
  id: string;
  tenant_id: string;
  name: string;
  primary_domain: string | null;
  site_platform: string | null;
  languages: string[];
  onboarding_step: number;
  setup_status: string;
  setup_note: string | null;
  setup_submitted_at: string | null;
};
export type Subscription = { plan: string; status: string; trial_ends_at: string | null; trial_started_at?: string | null; extra_prompts?: number | null };

/** Signed-in user + their tenant (created on first visit) + their brand (if started) + current TrueVisible subscription. */
export const getWorkspace = cache(async function getWorkspace() {
  const supabase = await createClient();
  // The middleware has already validated the session with Supabase Auth on this request; here the JWT's signature is
  // checked locally (getClaims), which saves a round trip to Auth on every page.
  const { data: claims } = await supabase.auth.getClaims();
  const sub0 = claims?.claims?.sub;
  if (!sub0) redirect("/login");
  const user = { id: sub0 as string, email: (claims!.claims.email as string | undefined) ?? null };

  const { data: member } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  let tenantId = member?.tenant_id as string | undefined;
  if (!tenantId) {
    // Named "My workspace" until the first brand is saved, then renamed after it (see saveBrand).
    const { data, error } = await supabase.rpc("tv_bootstrap_tenant", { p_name: null });
    if (error) throw new Error(`Could not create workspace: ${error.message}`);
    tenantId = data as string;
  }

  const [{ data: brand }, { data: sub }] = await Promise.all([
    supabase
      .from("brands")
      .select("id, tenant_id, name, primary_domain, site_platform, languages, onboarding_step, setup_status, setup_note, setup_submitted_at")
      .eq("tenant_id", tenantId)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("plan, status, trial_ends_at, trial_started_at, extra_prompts")
      .eq("tenant_id", tenantId)
      .eq("product", "truevisible")
      .is("brand_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return { supabase, user, tenantId, brand: (brand as Brand | null) ?? null, subscription: (sub as Subscription | null) ?? null };
});

export { promptLimit, trialState, trialDaysLeft, type TrialState } from "@/lib/plan";
