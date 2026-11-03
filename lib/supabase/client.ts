"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client (signed-in user's session cookie; RLS applies). */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
