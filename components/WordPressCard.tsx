import { SubmitButton } from "@/components/SubmitButton";
import { disconnectWordPress, saveWordPress } from "@/app/dashboard/settings/actions";

type Wp = { status: string; config: { endpoint?: string; server?: string; tool_count?: number; can_write?: boolean; error?: string | null; tested_at?: string } } | null;
const when = (d?: string) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—");

/** Settings → WordPress: connect through the free Easy MCP AI plugin (endpoint + token), see the check result, disconnect. */
export function WordPressCard({ wp, flash }: { wp: Wp; flash?: string }) {
  const form = (
    <form action={saveWordPress} className="stack-s">
      <details className="small">
        <summary>How to get these (5 minutes)</summary>
        <ol className="stack-xs" style={{ marginTop: 8, paddingLeft: 18 }}>
          <li>In your WordPress admin: <strong>Plugins → Add New</strong>, search <strong>“Easy MCP AI”</strong>, install and activate it (free).</li>
          <li>Open the plugin&apos;s settings and create an <strong>API token</strong>. Give it <strong>Read</strong> and <strong>Write</strong> access. Leave <strong>Destructive</strong> off — we never delete anything.</li>
          <li>Copy the <strong>MCP endpoint URL</strong> the plugin shows (it starts with https://your-site) and the token, and paste both below.</li>
        </ol>
      </details>
      <label className="stack-xs"><span className="small">MCP endpoint URL</span>
        <input name="endpoint" type="url" required placeholder="https://yoursite.com/wp-json/…" defaultValue={wp?.config?.endpoint ?? ""} />
      </label>
      <label className="stack-xs"><span className="small">API token</span>
        <input name="token" type="password" required minLength={16} autoComplete="off" placeholder="Paste the token" />
      </label>
      <p className="small muted">The token is stored encrypted and is only used to make the changes you approve. You can revoke it in the plugin at any time.</p>
      <div><SubmitButton pending="Saving…">Connect WordPress</SubmitButton></div>
    </form>
  );
  return (
    <div className="stack-s" id="wordpress">
      <p className="small muted">Lets us publish approved pages, FAQs and schema straight to your WordPress site — every change is listed in the actions log.</p>
      {flash && <p className="small" role="status" style={{ color: "var(--coral-dark)" }}>{flash}</p>}
      {wp?.status === "connected" ? (
        <>
          <p><strong>Connected</strong> · {wp.config.server ?? "Easy MCP AI"}<br />
            <span className="small muted">{wp.config.tool_count ?? 0} tools available{wp.config.can_write === false ? " · read-only token — give it Write access so we can publish" : ""} · checked {when(wp.config.tested_at)}</span></p>
          <form action={disconnectWordPress}><SubmitButton pending="Disconnecting…" variant="secondary">Disconnect</SubmitButton></form>
        </>
      ) : wp?.status === "pending" ? (
        <>
          <p><strong>Checking the connection…</strong><br /><span className="small muted">Usually under 2 minutes. Refresh this page to see the result.</span></p>
          <form action={disconnectWordPress}><SubmitButton pending="Cancelling…" variant="secondary">Cancel</SubmitButton></form>
        </>
      ) : wp?.status === "error" ? (
        <>
          <p className="small" style={{ color: "var(--coral-dark)" }}>We couldn&apos;t connect: {wp.config.error ?? "unknown error"}. Check the URL and token and try again.</p>
          {form}
        </>
      ) : form}
    </div>
  );
}
