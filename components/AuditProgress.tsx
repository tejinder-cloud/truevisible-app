"use client";
// Live progress of the first audit after a setup submission. Polls the brand's runs and answers (RLS: own tenant only)
// and refreshes the page when every engine has finished — no manual refresh needed.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LABEL: Record<string, string> = { chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity", ai_overviews: "AI Overviews", copilot: "Copilot" };
const ORDER = ["chatgpt", "gemini", "perplexity", "ai_overviews", "copilot"];
type Run = { id: string; engine: string; status: string };

export function AuditProgress({ brandId, submittedAt, promptCount, updating }: { brandId: string; submittedAt: string; promptCount: number; updating: boolean }) {
  const router = useRouter();
  const [runs, setRuns] = useState<Run[]>([]);
  const [done, setDone] = useState<Record<string, number>>({});
  const [now, setNow] = useState<number | null>(null); // set after mount: server and browser clocks differ (hydration)
  const finished = useRef(false);

  useEffect(() => {
    const sb = createClient();
    let stop = false;
    async function tick() {
      const { data: r } = await sb.from("runs").select("id, engine, status").eq("brand_id", brandId).gte("created_at", submittedAt);
      const list = (r ?? []) as Run[];
      const counts: Record<string, number> = {};
      if (list.length) {
        const { data: a } = await sb.from("answers").select("run_id").in("run_id", list.map((x) => x.id)).limit(1000);
        for (const row of a ?? []) counts[row.run_id] = (counts[row.run_id] ?? 0) + 1;
      }
      if (stop) return;
      setRuns(list);
      setDone(counts);
      if (list.length && list.every((x) => x.status !== "running" && x.status !== "queued") && !finished.current) {
        finished.current = true;
        router.refresh();
      }
    }
    tick();
    const poll = setInterval(() => { if (!finished.current) tick(); }, 4000);
    setNow(Date.now());
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { stop = true; clearInterval(poll); clearInterval(clock); };
  }, [brandId, submittedAt, router]);

  const elapsed = now == null ? 0 : Math.max(0, Math.floor((now - Date.parse(submittedAt)) / 1000));
  const mmss = now == null ? "" : `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const engines = ORDER.filter((e) => runs.some((r) => r.engine === e));
  const total = promptCount * Math.max(engines.length, 1);
  const answered = runs.reduce((n, r) => n + (done[r.id] ?? 0), 0);
  const slow = elapsed > 10 * 60;

  return (
    <section className="card ink stack-s" aria-live="polite" aria-busy={!finished.current}>
      <div className="spread">
        <p className="eyebrow" style={{ color: "var(--on-dark)", opacity: 0.75 }}>{updating ? "Updating your audit" : "Your first audit"}</p>
        <span className="small" style={{ opacity: 0.75, fontVariantNumeric: "tabular-nums" }}>{mmss}</span>
      </div>
      <h2>{runs.length ? `Asking AI your ${promptCount} questions…` : "Starting your audit…"}</h2>
      <p style={{ opacity: 0.85 }}>
        {runs.length
          ? `${answered} of ${total} answers in. This page updates by itself — usually 2 to 4 minutes in all.`
          : "Your questions go to ChatGPT, Gemini and Perplexity within a minute."}
      </p>
      {engines.length > 0 && (
        <ul className="progress-list">
          {engines.map((e) => {
            const r = runs.filter((x) => x.engine === e).at(-1)!;
            const n = done[r.id] ?? 0;
            const pct = Math.min(100, Math.round((n / Math.max(promptCount, 1)) * 100));
            const state = r.status === "running" ? `${n} of ${promptCount}` : r.status === "failed" ? "Couldn't finish — we'll retry" : "Done";
            return (
              <li key={e}>
                <span className="progress-name">{LABEL[e] ?? e}</span>
                <span className="progress-track"><span className="progress-bar" style={{ width: `${r.status === "running" ? pct : 100}%`, opacity: r.status === "failed" ? 0.4 : 1 }} /></span>
                <span className="small progress-state">{state}</span>
              </li>
            );
          })}
        </ul>
      )}
      {slow && <p className="small" style={{ opacity: 0.8 }}>This is taking longer than usual. You can leave this page — results will be here when you come back.</p>}
    </section>
  );
}
