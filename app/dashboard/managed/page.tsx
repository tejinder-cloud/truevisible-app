import { redirect } from "next/navigation";

// The offer and pricing live on thegrowthlab.co.in; this old address forwards there via /go (which logs the click).
export default async function Managed({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  redirect(`/dashboard/managed/go${from ? `?from=${encodeURIComponent(from)}` : ""}`);
}
