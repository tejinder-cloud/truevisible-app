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
  const as = String(fd.get("as") ?? "");
  await supabase.rpc("tv_wp_request_draft", { p_rec: id, p_as: as === "post" || as === "page" ? as : null });
  revalidatePath("/dashboard/recommendations");
}

export async function requestWpPublish(fd: FormData) {
  const { supabase } = await getWorkspace();
  const id = String(fd.get("action") ?? "");
  if (!id) return;
  let texts: string[] | null = null;
  try { const t = JSON.parse(String(fd.get("texts") ?? "null")); if (Array.isArray(t) && t.every((x) => typeof x === "string")) texts = t; } catch { texts = null; }
  await supabase.rpc("tv_wp_request_publish", { p_action: id, p_texts: texts });
  revalidatePath("/dashboard/recommendations");
}
