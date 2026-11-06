import { SubmitButton } from "@/components/SubmitButton";
import { disconnectGa4, selectGa4Property } from "@/app/dashboard/settings/actions";

type Ga4 = { status: string; config: { account_email?: string; properties?: { id: string; name: string; account: string }[]; property_id?: string; property_name?: string } } | null;
const NOTE: Record<string, string> = {
  cancelled: "Google sign-in was cancelled.", expired: "That took too long — please try again.", failed: "Google didn't return access. Please try again.",
  noproperties: "That Google account has no Google Analytics 4 properties. Sign in with the account that owns your GA4.", unavailable: "Google Analytics connection isn't switched on yet.",
};

/** Settings → Google Analytics 4: connect, pick the property, or disconnect. */
export function Ga4Card({ ga4, configured, flash, brandName, domain }: { ga4: Ga4; configured: boolean; flash?: string; brandName: string; domain: string | null }) {
  // Best guess first: a property named like the brand or its domain (an agency login can see dozens).
  const norm = (x: string) => x.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[^a-z0-9]+/g, " ").trim();
  const keys = [norm(brandName), ...(domain ? [norm(domain), norm(domain.split(".")[0])] : [])].filter((k) => k.length >= 3);
  const score = (p: { name: string }) => (keys.some((k) => norm(p.name) === k) ? 2 : keys.some((k) => norm(p.name).includes(k)) ? 1 : 0);
  const props = [...(ga4?.config?.properties ?? [])].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
  return (
    <div className="stack-s">
      <p className="small muted">Shows visits that came from ChatGPT, Gemini, Perplexity and Copilot — and what they did — on the Impact tab. Read-only access.</p>
      {flash && NOTE[flash] && <p className="small" role="status" style={{ color: "var(--coral-dark)" }}>{NOTE[flash]}</p>}
      {ga4?.status === "connected" ? (
        <>
          <p><strong>Connected</strong> · {ga4.config.property_name}<br /><span className="small muted">{ga4.config.account_email}</span></p>
          <form action={disconnectGa4}><SubmitButton pending="Disconnecting…" variant="secondary">Disconnect</SubmitButton></form>
        </>
      ) : ga4?.status === "pending" && props.length ? (
        <form action={selectGa4Property} className="stack-s">
          <label className="stack-xs"><span className="small">Which property is your website?{props.length > 1 ? ` (${props.length} found — best match first)` : ""}</span>
            <select name="property" defaultValue={props[0].id}>{props.map((p) => <option key={p.id} value={p.id}>{p.name}{p.account ? ` — ${p.account}` : ""}</option>)}</select>
          </label>
          <div className="row" style={{ gap: 12 }}><SubmitButton pending="Saving…">Use this property</SubmitButton></div>
        </form>
      ) : configured ? (
        <p><a className="btn btn-secondary btn-s" href="/dashboard/integrations/ga4/start">Connect Google Analytics</a></p>
      ) : (
        <p className="muted">Not connected yet · coming soon</p>
      )}
    </div>
  );
}
