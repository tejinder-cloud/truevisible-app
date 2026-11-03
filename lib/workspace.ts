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
export type Subscription = { plan: string; status: string; trial_ends_at: string | null };

/** Signed-in user + their tenant (created on first visit) + their brand (if started) + current TrueVisible subscription. */
export async function getWorkspace() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
      .select("plan, status, trial_ends_at")
      .eq("tenant_id", tenantId)
      .eq("product", "truevisible")
      .is("brand_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return { supabase, user, tenantId, brand: (brand as Brand | null) ?? null, subscription: (sub as Subscription | null) ?? null };
}

/** Mirrors private.tv_prompt_limit in the database (which is the real enforcement). */
export function promptLimit(sub: Subscription | null): number {
  if (!sub) return 0;
  if (sub.plan === "trial") return sub.status === "trialing" && sub.trial_ends_at && new Date(sub.trial_ends_at) > new Date() ? 10 : 0;
  if (sub.plan === "internal") return 50;
  return ["active", "past_due"].includes(sub.status) ? 50 : 0;
}

export function trialDaysLeft(sub: Subscription | null): number | null {
  if (!sub || sub.plan !== "trial" || !sub.trial_ends_at) return null;
  return Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86_400_000));
}
