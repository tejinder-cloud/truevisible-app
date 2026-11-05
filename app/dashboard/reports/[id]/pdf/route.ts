import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Download a report's PDF: the report row and the file are both read with the user's own rights (RLS + storage
// policy on the tenant folder), then a 60-second signed link is handed to the browser.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: rep } = await supabase.from("reports").select("url").eq("id", id).maybeSingle();
  if (!rep?.url) return NextResponse.redirect(new URL(`/dashboard/reports/${id}`, req.url));
  const { data, error } = await supabase.storage.from("reports").createSignedUrl(rep.url, 60, { download: true });
  if (error || !data?.signedUrl) return NextResponse.redirect(new URL(`/dashboard/reports/${id}?pdf=missing`, req.url));
  return NextResponse.redirect(data.signedUrl);
}
