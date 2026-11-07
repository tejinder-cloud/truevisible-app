"use client";
import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="card stack-s" role="status">
        <h2>Check your inbox</h2>
        <p>We've sent a sign-in link to <strong>{state.email}</strong>. Open it on this device to continue.</p>
        <p className="small muted">Nothing after a couple of minutes? Check spam, or <a href="/login">try again</a>.</p>
      </div>
    );
  }
  return (
    <form action={action} className="card stack-m" noValidate>
      <label className="field">
        <span className="label">Work email</span>
        <input type="email" name="email" autoComplete="email" inputMode="email" required defaultValue={state.email} placeholder="you@yourbusiness.com" />
        <span className="hint">No password. We email you a one-time link. New here? The same link starts your free 7-day trial — no card. The 7 days begin once our team has checked your setup.</span>
      </label>
      {state.status === "error" && <p className="error" role="alert">{state.message}</p>}
      <SubmitButton pending="Sending link…">Email me a sign-in link</SubmitButton>
      <input type="hidden" name="next" value={next ?? ""} />
    </form>
  );
}
