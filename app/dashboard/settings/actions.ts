"use server";
import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/workspace";

export async function saveEmailPrefs(fd: FormData) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.rpc("tv_set_email_prefs", { p_daily: fd.get("daily") === "on", p_weekly: fd.get("weekly") === "on", p_tips: fd.get("tips") === "on" });
  revalidatePath("/dashboard/settings");
  const { redirect } = await import("next/navigation");
  redirect(`/dashboard/settings?email=${error ? "error" : "saved"}&at=${Date.now()}#email`);
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

export async function saveWordPress(fd: FormData) {
  const { supabase, brand } = await getWorkspace();
  if (!brand) return;
  const endpoint = String(fd.get("endpoint") ?? "").trim();
  const token = String(fd.get("token") ?? "").trim();
  const { error } = await supabase.rpc("tv_wp_save", { p_brand: brand.id, p_endpoint: endpoint, p_token: token });
  const { redirect } = await import("next/navigation");
  revalidatePath("/dashboard/settings");
  redirect(`/dashboard/settings${error ? `?wp=${encodeURIComponent(error.message.replace(/^.*?: /, ""))}` : ""}#wordpress`);
}

export async function disconnectWordPress() {
  const { supabase, brand } = await getWorkspace();
  if (!brand) return;
  await supabase.rpc("tv_wp_disconnect", { p_brand: brand.id });
  revalidatePath("/dashboard/settings");
}

export async function requestErasure(fd: FormData) {
  const { supabase } = await getWorkspace();
  const { redirect } = await import("next/navigation");
  if (String(fd.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") redirect("/dashboard/settings?erase=confirm#data");
  const { error } = await supabase.rpc("tv_request_erasure", { p_reason: String(fd.get("reason") ?? "") });
  redirect(`/dashboard/settings?erase=${error ? "error" : "sent"}#data`);
}
