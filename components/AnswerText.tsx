// Renders an AI answer's light Markdown (bold, headings, lists, tables) as React elements — never as raw HTML.
import React from "react";

function inline(s: string, key: string): React.ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong> : <React.Fragment key={`${key}-${i}`}>{part.replace(/(^|\s)\*([^*]+)\*/g, "$1$2")}</React.Fragment>);
}
const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

export function AnswerText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (l.trim().startsWith("|") && lines[i + 1] && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = cells(l); const body: string[][] = []; i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) { body.push(cells(lines[i])); i++; }
      out.push(
        <div key={`t${i}`} className="table-wrap"><table className="data-table"><thead><tr>{head.map((h, j) => <th key={j} scope="col">{inline(h, `h${i}${j}`)}</th>)}</tr></thead>
          <tbody>{body.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}>{inline(c, `c${i}${k}${j}`)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, "")); i++; }
      out.push(<ul key={`u${i}`}>{items.map((it, k) => <li key={k}>{inline(it, `l${i}${k}`)}</li>)}</ul>);
      continue;
    }
    const h = l.match(/^#{1,6}\s+(.*)/);
    out.push(h ? <p key={`p${i}`}><strong>{inline(h[1], `hh${i}`)}</strong></p> : <p key={`p${i}`}>{inline(l, `p${i}`)}</p>);
    i++;
  }
  return <div className="answer-text">{out}</div>;
}
