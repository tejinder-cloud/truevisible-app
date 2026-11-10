"use server";
import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/workspace";

export async function markPlanItemDone(fd: FormData) {
  const { supabase } = await getWorkspace();
  const url = String(fd.get("url") ?? "").trim();
  await supabase.rpc("tv_plan_item_done", { p_plan: String(fd.get("plan")), p_item: String(fd.get("item")), p_url: url ? (/^https?:\/\//.test(url) ? url : `https://${url}`) : null, p_note: null });
  revalidatePath("/dashboard/plan");
}

export async function undoPlanItem(fd: FormData) {
  const { supabase } = await getWorkspace();
  await supabase.rpc("tv_plan_item_undo", { p_plan: String(fd.get("plan")), p_item: String(fd.get("item")) });
  revalidatePath("/dashboard/plan");
}
