import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

// Download a GST tax invoice: the invoice row and the file are read with the user's own rights (RLS + storage
// policy on the tenant folder), then a 60-second signed link is handed to the browser.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: inv } = await supabase.from("invoices").select("pdf_url").eq("id", id).maybeSingle();
  const back = new URL("/dashboard/settings#plan", siteUrl(req.nextUrl.origin));
  if (!inv?.pdf_url) return NextResponse.redirect(back);
  const { data, error } = await supabase.storage.from("invoices").createSignedUrl(inv.pdf_url, 60, { download: true });
  if (error || !data?.signedUrl) return NextResponse.redirect(back);
  return NextResponse.redirect(data.signedUrl);
}
