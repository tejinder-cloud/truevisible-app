// Plan rules (pure). Decision 7 Nov 2026: Track / Managed 50 questions, Managed Plus 100, trial 10 for 7 days.
import type { Subscription } from "@/lib/workspace";

/** Mirrors private.tv_prompt_limit in the database (which is the real enforcement). Decision 7 Nov 2026. */
export function promptLimit(sub: Subscription | null): number {
  if (!sub) return 0;
  if (sub.plan === "trial") return sub.status === "trialing" && (!sub.trial_ends_at || new Date(sub.trial_ends_at) > new Date()) ? 10 : 0;
  if (sub.plan === "internal") return 50;
  if (!["active", "past_due"].includes(sub.status)) return 0;
  return (sub.plan === "managed_plus" ? 100 : 50) + (sub.extra_prompts ?? 0);
}

export type TrialState = { kind: "none" } | { kind: "not_started" } | { kind: "live"; daysLeft: number } | { kind: "ended" };
/** 7-day trial that starts at the first completed check after our team verifies the setup. */
export function trialState(sub: Subscription | null): TrialState {
  if (!sub || sub.plan !== "trial") return { kind: "none" };
  if (sub.status === "expired" || (sub.trial_ends_at && new Date(sub.trial_ends_at) <= new Date())) return { kind: "ended" };
  if (!sub.trial_started_at || !sub.trial_ends_at) return { kind: "not_started" };
  return { kind: "live", daysLeft: Math.max(1, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86_400_000)) };
}

export function trialDaysLeft(sub: Subscription | null): number | null {
  const t = trialState(sub);
  return t.kind === "live" ? t.daysLeft : t.kind === "ended" ? 0 : null;
}
