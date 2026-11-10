import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { SubmitButton } from "@/components/SubmitButton";
import { legalFacts } from "@/lib/legal";
import { acceptTerms } from "./actions";

export const metadata = { title: "Before you continue" };

export default async function ConsentPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const f = legalFacts();
  return (
    <>
      <TopBar />
      <main className="narrow stack-m" style={{ paddingTop: 64, paddingBottom: 96 }}>
        <h1>Before you continue</h1>
        <p>TrueVisible is provided by {f.name}, trading as {f.trading}. To create and run your account we process your email address and the business details you enter — as described in our <Link href="/legal/privacy" target="_blank">Privacy Notice</Link>.</p>
        <ul className="stack-xs">
          <li>We use your data only to run TrueVisible for you, send the emails you choose, and bill you.</li>
          <li>You can download your data, correct it or ask us to delete it any time in Settings → Your data.</li>
          <li>We never guarantee what AI assistants will say — see the <Link href="/legal/terms" target="_blank">Terms of Service</Link>.</li>
        </ul>
        <form action={acceptTerms} className="stack-s card">
          <label className="row" style={{ gap: 10, alignItems: "flex-start" }}>
            <input type="checkbox" name="agree" required style={{ width: 20, height: 20, marginTop: 2 }} />
            <span>I agree to the <Link href="/legal/terms" target="_blank">Terms of Service</Link> and consent to {f.name} processing my personal data as described in the <Link href="/legal/privacy" target="_blank">Privacy Notice</Link>.</span>
          </label>
          {error && <p className="small" role="alert" style={{ color: "var(--coral-dark)" }}>Please tick the box to continue.</p>}
          <div><SubmitButton pending="Saving…">Continue</SubmitButton></div>
        </form>
        <p className="small muted">You can withdraw consent at any time by closing your account in Settings → Your data.</p>
      </main>
    </>
  );
}
