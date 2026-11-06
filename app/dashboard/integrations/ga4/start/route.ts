import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/site";
import { ga4AuthUrl, ga4Configured } from "@/lib/ga4";

export async function GET(req: NextRequest) {
  if (!ga4Configured()) return NextResponse.redirect(new URL("/dashboard/settings?ga4=unavailable#integrations", siteUrl(req.nextUrl.origin)));
  const state = randomBytes(24).toString("base64url");
  const redirectUri = `${siteUrl(req.nextUrl.origin)}/dashboard/integrations/ga4/callback`;
  const res = NextResponse.redirect(ga4AuthUrl(redirectUri, state));
  res.cookies.set("tv_ga4_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/dashboard/integrations/ga4", maxAge: 600 });
  return res;
}
