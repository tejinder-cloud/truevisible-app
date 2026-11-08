"use client";
import { useState } from "react";
import { PendingButton } from "@/components/PendingButton";
import type { MetaChange } from "@/lib/execution";

const LIMIT = { title: 60, description: 155 } as const;

/** The SEO titles & descriptions waiting for approval: each new value editable, with a live length count, then Apply. */
export function MetaEditForm({ actionId, changes, action }: { actionId: string; changes: MetaChange[]; action: (fd: FormData) => Promise<void> }) {
  const [texts, setTexts] = useState(changes.map((c) => c.new));
  const empty = texts.some((t) => !t.trim());
  return (
    <form action={action} className="stack-s">
      <input type="hidden" name="action" value={actionId} />
      <input type="hidden" name="texts" value={JSON.stringify(texts.map((t) => t.trim()))} />
      <div className="table-wrap"><table className="data-table small">
        <thead><tr><th>Page</th><th>Field</th><th>Now</th><th>Change to (you can edit)</th></tr></thead>
        <tbody>{changes.map((c, i) => {
          const n = texts[i].trim().length; const max = LIMIT[c.field];
          return (
            <tr key={i}>
              <td>{c.link ? <a href={c.link} target="_blank" rel="noopener">{c.page_title}</a> : c.page_title}</td>
              <td>{c.field === "title" ? "SEO title" : "Meta description"}</td>
              <td className="muted">{c.old || "— (theme default)"}</td>
              <td style={{ minWidth: 280 }}>
                <textarea aria-label={`${c.field === "title" ? "SEO title" : "Meta description"} for ${c.page_title}`} rows={c.field === "title" ? 2 : 3} maxLength={300}
                  value={texts[i]} onChange={(e) => setTexts((t) => t.map((x, j) => (j === i ? e.target.value : x)))} style={{ width: "100%", fontSize: 14 }} />
                <span className="small" style={{ color: n > max || n === 0 ? "var(--coral-dark)" : "var(--text-2)" }}>
                  {n} / {max}{n > max ? " — Google will cut the end" : n === 0 ? " — can't be empty" : ""}
                </span>
              </td>
            </tr>
          );
        })}</tbody>
      </table></div>
      <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {empty ? <button type="button" className="btn btn-s" disabled>Apply these</button> : <PendingButton className="btn btn-s" pending="Sending…">Apply these</PendingButton>}
        {texts.some((t, i) => t !== changes[i].new) && <button type="button" className="btn-link small" onClick={() => setTexts(changes.map((c) => c.new))}>Undo my edits</button>}
      </div>
    </form>
  );
}
