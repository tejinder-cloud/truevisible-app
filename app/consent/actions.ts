"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LEGAL_VERSION } from "@/lib/legal";

export async function acceptTerms(fd: FormData) {
  if (fd.get("agree") !== "on") redirect("/consent?error=1");
  const supabase = await createClient();
  await supabase.rpc("tv_accept_terms", { p_version: LEGAL_VERSION });
  redirect("/dashboard");
}
