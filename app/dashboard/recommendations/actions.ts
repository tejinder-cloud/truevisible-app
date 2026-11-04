"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/workspace";

const ALLOWED = ["open", "diy", "done", "dismissed"];

export async function setRecommendationStatus(fd: FormData) {
  const { supabase } = await getWorkspace();
  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "");
  if (!id || !ALLOWED.includes(status)) return;
  await supabase.rpc("tv_set_recommendation_status", { p_id: id, p_status: status });
  revalidatePath("/dashboard/recommendations");
  revalidatePath("/dashboard");
}

export async function requestManagedAeo(fd: FormData) {
  const { supabase, brand } = await getWorkspace();
  if (!brand) redirect("/onboarding");
  const rec = String(fd.get("recommendation") ?? "") || null;
  const note = String(fd.get("note") ?? "").slice(0, 1000) || null;
  const { error } = await supabase.rpc("tv_request_managed_aeo", { p_brand: brand.id, p_recommendation: rec, p_note: note });
  if (error) redirect(`/dashboard/managed?error=1${rec ? `&from=${rec}` : ""}`);
  redirect("/dashboard/managed?sent=1");
}
