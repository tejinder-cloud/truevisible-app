"use client";
// Copy / download one recommendation's asset. Text only — nothing is executed or injected.
import { useState } from "react";

export function AssetActions({ title, format, body }: { title: string; format: string; body: string }) {
  const [copied, setCopied] = useState(false);
  const ext = format === "json" ? "json" : format === "text" ? "txt" : "md";
  const name = /llms\.txt/i.test(title) ? "llms.txt" : `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "asset"}.${ext}`;
  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      <button type="button" className="btn btn-secondary btn-s" onClick={async () => {
        try { await navigator.clipboard.writeText(body); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: download still works */ }
      }}>{copied ? "Copied" : "Copy"}</button>
      <button type="button" className="btn btn-secondary btn-s" onClick={() => {
        const url = URL.createObjectURL(new Blob([body], { type: format === "json" ? "application/ld+json" : "text/plain;charset=utf-8" }));
        const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>Download {name.endsWith(".txt") && name !== "llms.txt" ? ".txt" : name === "llms.txt" ? "llms.txt" : `.${ext}`}</button>
    </div>
  );
}
