"use server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: "error", message: "Enter a valid work email.", email };

  const h = await headers();
  const origin = siteUrl(`${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext(formData.get("next")))}`, shouldCreateUser: true },
  });
  // The success message is shown only when Supabase accepted the request (AGENTS.md mandate 8).
  if (error) {
    const rate = /rate limit|too many/i.test(error.message);
    return { status: "error", email, message: rate ? "Too many sign-in emails just now. Wait a minute and try again." : `We couldn't send the link: ${error.message}` };
  }
  return { status: "sent", email };
}
