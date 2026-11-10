import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(next?.startsWith("/") ? next : "/dashboard");

  return (
    <>
      <TopBar />
      <main className="narrow stack-l" style={{ paddingTop: 64, paddingBottom: 96 }}>
        <div className="stack-s">
          <p className="eyebrow">AI visibility for your brand</p>
          <h1>See what AI says about you, and <em className="accent">fix it</em>.</h1>
          <p className="muted" style={{ fontSize: 18 }}>
            ChatGPT, Gemini, Perplexity, Google AI Overviews and Copilot — what they say about your business, who they cite instead, and what to do next.
          </p>
        </div>
        {error && <p className="notice" role="alert">That sign-in link didn't work — it may have expired or been opened on another device. Request a new one below.</p>}
        <LoginForm next={next} />
        <p className="small muted">By continuing you agree to our <Link href="/legal/terms">Terms of Service</Link> and <Link href="/legal/privacy">Privacy Notice</Link>.</p>
      </main>
    </>
  );
}
