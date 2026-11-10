"use client";
// Track checkout: pick monthly/annual and India/outside India, optional GSTIN, then Razorpay Checkout.
import { useState } from "react";
import { confirmTrackCheckout, startTrackCheckout } from "@/app/dashboard/upgrade/actions";
import { chargeMinor, formatMoney, type Currency, type Interval } from "@/lib/billing";
import { GST_STATES } from "@/lib/gst-states";

declare global { interface Window { Razorpay?: any } }

function loadScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true); s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function TrackCheckout({ exportsOn = false }: { exportsOn?: boolean }) {
  const [currency, setCurrency] = useState<Currency>("INR");
  const [interval, setInterval] = useState<Interval>("month");
  const [gstin, setGstin] = useState(""); const [legal, setLegal] = useState(""); const [state, setState] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null); const [done, setDone] = useState(false);
  const c = chargeMinor(currency, interval);

  async function pay() {
    if (currency === "INR" && !gstin && !state) { setMsg("Pick your state — it decides the GST on your invoice."); return; }
    setBusy(true); setMsg(null);
    const r = await startTrackCheckout({ currency, interval, gstin, legalName: legal, state });
    if (!r.ok) { setBusy(false); setMsg(r.error); return; }
    if (!(await loadScript())) { setBusy(false); setMsg("Couldn't load the payment window. Check your connection and try again."); return; }
    const rz = new window.Razorpay({
      key: r.keyId, subscription_id: r.subscriptionId, name: "TrueVisible", description: `Track · ${interval === "year" ? "annual" : "monthly"}`,
      prefill: { email: r.email }, notes: { brand: r.name }, theme: { color: "#D9644A" },
      handler: async (resp: any) => {
        const ok = await confirmTrackCheckout({ subscriptionId: resp.razorpay_subscription_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature });
        setBusy(false);
        if (ok.ok) { setDone(true); setTimeout(() => (window.location.href = "/dashboard/settings?upgraded=1#plan"), 1500); }
        else setMsg("Payment received but we couldn't confirm it automatically. Our team will check within a working day — no need to pay again.");
      },
      modal: { ondismiss: () => setBusy(false) },
    });
    rz.open();
  }

  if (done) return <p role="status"><strong>You're on Track.</strong> Taking you to your plan…</p>;
  return (
    <div className="stack-s">
      <fieldset className="row" style={{ gap: 8, flexWrap: "wrap", border: 0, padding: 0, margin: 0 }}>
        <legend className="small muted" style={{ marginBottom: 6 }}>Billed</legend>
        {(["month", "year"] as Interval[]).map((i) => (
          <button key={i} type="button" className={`chip filter${interval === i ? " on" : ""}`} aria-pressed={interval === i} onClick={() => setInterval(i)}>
            {i === "month" ? "Monthly" : "Annual · 2 months free"}
          </button>
        ))}
      </fieldset>
      <fieldset className="row" style={{ gap: 8, flexWrap: "wrap", border: 0, padding: 0, margin: 0 }}>
        <legend className="small muted" style={{ marginBottom: 6 }}>Your business is</legend>
        {(exportsOn ? (["INR", "USD"] as Currency[]) : (["INR"] as Currency[])).map((k) => (
          <button key={k} type="button" className={`chip filter${currency === k ? " on" : ""}`} aria-pressed={currency === k} onClick={() => setCurrency(k)}>
            {k === "INR" ? "In India (₹, GST)" : "Outside India ($, no GST)"}
          </button>
        ))}
      </fieldset>
      {currency === "INR" && (
        <div className="grid-2" style={{ gap: 12 }}>
          <label className="stack-xs"><span className="small">GSTIN <span className="muted">(optional, for a GST invoice)</span></span>
            <input type="text" value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} maxLength={15} placeholder="03ABCDE1234F1Z5" autoComplete="off" /></label>
          <label className="stack-xs"><span className="small">Business name on invoice <span className="muted">(optional)</span></span>
            <input type="text" value={legal} onChange={(e) => setLegal(e.target.value)} maxLength={200} /></label>
          {!gstin && (
            <label className="stack-xs"><span className="small">State <span className="muted">(for the GST on your invoice)</span></span>
              <select value={state} onChange={(e) => setState(e.target.value)}>
                <option value="">Choose…</option>
                {GST_STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select></label>
          )}
        </div>
      )}
      <div className="card" style={{ padding: 16, background: "var(--cream)" }}>
        <p className="row" style={{ justifyContent: "space-between" }}><span>Track · {interval === "year" ? "annual" : "monthly"}</span><span>{formatMoney(c.price, currency)}</span></p>
        {currency === "INR" && <p className="row small muted" style={{ justifyContent: "space-between" }}><span>GST 18%</span><span>{formatMoney(c.gst, currency)}</span></p>}
        <p className="row" style={{ justifyContent: "space-between", fontWeight: 600, marginTop: 6 }}><span>Total today, then every {interval === "year" ? "year" : "month"}</span><span>{formatMoney(c.total, currency)}</span></p>
      </div>
      {msg && <p className="small" role="alert" style={{ color: "var(--coral-dark)" }}>{msg}</p>}
      <div><button type="button" className="btn btn-primary" onClick={pay} disabled={busy}>{busy ? "Opening payment…" : `Pay ${formatMoney(c.total, currency)} with Razorpay`}</button></div>
      <p className="small muted">Card, UPI or netbanking. Renews automatically; cancel any time in Settings — you keep Track until the end of the period you paid for.</p>
    </div>
  );
}
