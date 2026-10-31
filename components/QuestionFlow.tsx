"use client";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

export type Question = {
  id: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  body: React.ReactNode;
  /** Return an error message to stop the user moving on. Reads the whole form. */
  validate?: (fd: FormData) => string | null;
  /** Leave this question out (e.g. no website → no website questions). */
  skip?: boolean;
  /** Optional questions show "Skip" instead of "Continue" while empty. */
  optional?: boolean;
  isEmpty?: (fd: FormData) => boolean;
  /** Runs when the user moves past this question. */
  onLeave?: () => void;
};

/**
 * Shows one question at a time inside a <form>. Every question stays mounted (just hidden), so all answers
 * are submitted together on the last one and the server action is unchanged.
 */
export function QuestionFlow({ questions, submitLabel, pendingLabel, serverError, backHref }: {
  questions: Question[]; submitLabel: string; pendingLabel: string; serverError?: string; backHref?: string;
}) {
  const active = questions.map((q, i) => (q.skip ? -1 : i)).filter((i) => i >= 0);
  const [cur, setCur] = useState(active[0] ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [, force] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const pos = Math.max(0, active.indexOf(cur));
  const isLast = pos === active.length - 1;

  // If the question we're on becomes skipped (e.g. "No website" chosen), stay on a valid one.
  useEffect(() => {
    if (!active.includes(cur)) setCur(active.find((i) => i > cur) ?? active[active.length - 1]);
  }, [active.join(","), cur]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = root.current?.querySelector<HTMLElement>(`[data-q="${cur}"] input:not([type=hidden]):not([type=radio]):not([type=checkbox]), [data-q="${cur}"] textarea`);
    el?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [cur]);

  useEffect(() => { if (serverError) setError(serverError); }, [serverError]);

  const formData = () => new FormData(root.current!.closest("form")!);

  function next() {
    const q = questions[cur];
    const msg = q.validate?.(formData()) ?? null;
    setError(msg);
    if (msg) return false;
    q.onLeave?.();
    if (!isLast) setCur(active[pos + 1]);
    return true;
  }
  function back() {
    setError(null);
    if (pos > 0) setCur(active[pos - 1]);
  }
  function onKeyDown(e: React.KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (e.key === "Enter" && t.tagName === "INPUT" && (t as HTMLInputElement).type !== "checkbox") {
      e.preventDefault();
      if (next() && isLast) root.current!.closest("form")!.requestSubmit();
    }
  }

  const q = questions[cur];
  const empty = q?.optional && q.isEmpty ? q.isEmpty(formData_safe(root)) : false;

  return (
    <div ref={root} className="qflow" onKeyDown={onKeyDown} onInput={() => { if (q?.optional) force((n) => n + 1); if (error) setError(null); }}>
      <div className="qflow-meter" aria-hidden="true">
        {active.map((i, n) => <span key={i} className={n < pos ? "done" : n === pos ? "on" : ""} />)}
      </div>
      <p className="eyebrow" aria-live="polite">Question {pos + 1} of {active.length}</p>

      {questions.map((qq, i) => (
        <section key={qq.id} data-q={i} hidden={i !== cur} aria-labelledby={`q-${qq.id}`} className="stack-m">
          <header className="stack-xs">
            <h1 id={`q-${qq.id}`} className="q-title">{qq.title}</h1>
            {qq.lead && <p className="muted">{qq.lead}</p>}
          </header>
          {qq.body}
        </section>
      ))}

      {error && <p className="error" role="alert">{error}</p>}

      <div className="spread qflow-nav">
        {pos > 0 ? (
          <button type="button" className="btn btn-secondary" onClick={back}>Back</button>
        ) : backHref ? (
          <a className="btn btn-secondary" href={backHref}>Back</a>
        ) : <span />}
        {isLast ? (
          <Submit label={submitLabel} pending={pendingLabel} validate={() => next()} />
        ) : (
          <button type="button" className={`btn ${empty ? "btn-secondary" : "btn-primary"}`} onClick={next}>
            {empty ? "Skip" : "Continue"}
          </button>
        )}
      </div>
      <p className="small muted qflow-hint">Press <kbd>Enter ↵</kbd> to continue</p>
    </div>
  );
}

function formData_safe(root: React.RefObject<HTMLDivElement | null>) {
  const f = root.current?.closest("form");
  return f ? new FormData(f) : new FormData();
}

function Submit({ label, pending, validate }: { label: string; pending: string; validate: () => boolean }) {
  const { pending: isPending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={isPending} aria-disabled={isPending}
      onClick={(e) => { if (!validate()) e.preventDefault(); }}>
      {isPending ? pending : label}
    </button>
  );
}
