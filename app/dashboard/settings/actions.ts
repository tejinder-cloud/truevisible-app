"use server";
import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/workspace";

export async function saveEmailPrefs(fd: FormData) {
  const { supabase } = await getWorkspace();
  await supabase.rpc("tv_set_email_prefs", { p_daily: fd.get("daily") === "on", p_weekly: fd.get("weekly") === "on" });
  revalidatePath("/dashboard/settings");
}
