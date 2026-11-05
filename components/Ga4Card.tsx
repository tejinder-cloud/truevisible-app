import { SubmitButton } from "@/components/SubmitButton";
import { disconnectGa4, selectGa4Property } from "@/app/dashboard/settings/actions";

type Ga4 = { status: string; config: { account_email?: string; properties?: { id: string; name: string; account: string }[]; property_id?: string; property_name?: string } } | null;
const NOTE: Record<string, string> = {
  cancelled: "Google sign-in was cancelled.", expired: "That took too long — please try again.", failed: "Google didn't return access. Please try again.",
  noproperties: "That Google account has no Google Analytics 4 properties. Sign in with the account that owns your GA4.", unavailable: "Google Analytics connection isn't switched on yet.",
};

/** Settings → Google Analytics 4: connect, pick the property, or disconnect. */
export function Ga4Card({ ga4, configured, flash }: { ga4: Ga4; configured: boolean; flash?: string }) {
  const props = ga4?.config?.properties ?? [];
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
          <label className="stack-xs"><span className="small">Which property is your website?</span>
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
