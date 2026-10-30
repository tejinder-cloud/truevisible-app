"use client";
import { useActionState } from "react";
import { saveMarket, type StepState } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

type Initial = { competitors: string; product: string; icp: string; location: string };

export function MarketStep({ brandName, initial }: { brandName: string; initial: Initial }) {
  const [state, action] = useActionState<StepState, FormData>(saveMarket, {});
  return (
    <form action={action} className="stack-l">
      <header className="stack-xs">
        <h1>Who you <em className="accent">compete</em> with</h1>
        <p className="muted">One product, one buyer, one place to start. You can add more after setup.</p>
      </header>

      <div className="card stack-m">
        <label className="field">
          <span className="label">What do you want AI to recommend {brandName} for?</span>
          <input type="text" name="product" required defaultValue={initial.product} placeholder="e.g. nursing entrance coaching" />
        </label>
        <label className="field">
          <span className="label">Who buys it?</span>
          <input type="text" name="icp" required defaultValue={initial.icp} placeholder="e.g. BSc nursing aspirants and their parents" />
        </label>
        <label className="field">
          <span className="label">Where?</span>
          <input type="text" name="location" required defaultValue={initial.location} placeholder="e.g. Mohali" />
          <span className="hint">A city or area. Buyers ask AI “best … in Mohali”, so city-level questions matter most.</span>
        </label>
      </div>

      <div className="card stack-s">
        <label className="field">
          <span className="label">Competitors</span>
          <textarea name="competitors" defaultValue={initial.competitors} rows={5} placeholder={"One per line: name — website\ne.g. ABC Academy — abcacademy.in"} />
          <span className="hint">The businesses you lose customers to. Up to 10.</span>
        </label>
        <p className="notice">Before your first audit, our setup team checks your category, competitors and prompts against what AI engines actually say — so your report compares you with the right businesses.</p>
      </div>

      {state.error && <p className="error" role="alert">{state.error}</p>}
      <div className="spread">
        <a className="btn btn-secondary" href="/onboarding?step=1">Back</a>
        <SubmitButton pending="Saving…">Continue</SubmitButton>
      </div>
    </form>
  );
}
