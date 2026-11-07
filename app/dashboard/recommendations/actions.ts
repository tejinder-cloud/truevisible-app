"use server";
import { revalidatePath } from "next/cache";
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

export async function requestWpDraft(fd: FormData) {
  const { supabase } = await getWorkspace();
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  await supabase.rpc("tv_wp_request_draft", { p_rec: id });
  revalidatePath("/dashboard/recommendations");
}

export async function requestWpPublish(fd: FormData) {
  const { supabase } = await getWorkspace();
  const id = String(fd.get("action") ?? "");
  if (!id) return;
  await supabase.rpc("tv_wp_request_publish", { p_action: id });
  revalidatePath("/dashboard/recommendations");
}
