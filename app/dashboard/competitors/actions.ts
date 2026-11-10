"use server";
import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/workspace";

export async function trackCompetitor(fd: FormData) {
  const { supabase, brand } = await getWorkspace();
  if (!brand) return;
  await supabase.rpc("tv_track_competitor", { p_brand: brand.id, p_name: String(fd.get("name") ?? "") });
  revalidatePath("/dashboard/competitors");
}
