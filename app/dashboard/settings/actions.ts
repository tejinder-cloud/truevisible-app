"use server";
import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/workspace";

export async function saveEmailPrefs(fd: FormData) {
  const { supabase } = await getWorkspace();
  await supabase.rpc("tv_set_email_prefs", { p_daily: fd.get("daily") === "on", p_weekly: fd.get("weekly") === "on" });
  revalidatePath("/dashboard/settings");
}

export async function selectGa4Property(fd: FormData) {
  const { supabase, brand } = await getWorkspace();
  if (!brand) return;
  await supabase.rpc("tv_ga4_select_property", { p_brand: brand.id, p_property: String(fd.get("property") ?? "") });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/impact");
}

export async function disconnectGa4() {
  const { supabase, brand } = await getWorkspace();
  if (!brand) return;
  await supabase.rpc("tv_ga4_disconnect", { p_brand: brand.id });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/impact");
}
