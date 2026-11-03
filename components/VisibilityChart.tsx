"use client";
// Visibility over time, one line per engine (SPEC §4). Fixed engine colours, 2px lines, ringed 8px markers,
// direct end labels nudged apart, legend, crosshair tooltip on hover/touch, and a table view.
import { useEffect, useMemo, useRef, useState } from "react";

export type Series = { engine: string; label: string; color: string; points: { date: string; pct: number; n: number; of: number }[] };

const L = 36, R = 104, T = 16, B = 32;
const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function VisibilityChart({ series }: { series: Series[] }) {
  const dates = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort(), [series]);
  const [hover, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const box = useRef<HTMLDivElement>(null);
  // Draw at the container's real pixel width so 11–12px text stays 11–12px on a phone.
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 480 ? 200 : 240;
  const x = (i: number) => (dates.length === 1 ? L + (W - L - R) / 2 : L + (i * (W - L - R)) / (dates.length - 1));
  const y = (pct: number) => T + ((100 - pct) / 100) * (H - T - B);

  // End labels: last value of each series, pushed apart so overlapping lines still get readable names.
  const ends = series
    .map((s) => ({ s, last: s.points[s.points.length - 1] }))
    .filter((e) => e.last)
    .map((e) => ({ ...e, y: y(e.last.pct) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 16) ends[i].y = ends[i - 1].y + 16;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = svg.current!.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    dates.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
    setHover(best);
  }

  const hd = hover != null ? dates[hover] : null;
  return (
    <div className="viz">
      <ul className="legend" aria-label="Engines">
        {series.map((s) => (
          <li key={s.engine}><span className="swatch" style={{ background: s.color }} />{s.label}</li>
        ))}
      </ul>
      <div className="viz-plot" ref={box}>
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Share of answers naming you, per engine, per day"
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: "pan-y" }}>
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--hairline)" strokeWidth={1} />
              <text x={L - 8} y={y(t) + 4} textAnchor="end" className="viz-axis">{t}%</text>
            </g>
          ))}
          {dates.map((d, i) => (
            (dates.length <= Math.floor(W / 80) || i % Math.ceil(dates.length / Math.floor(W / 80)) === 0 || i === dates.length - 1) && (
              <text key={d} x={x(i)} y={H - 10} textAnchor="middle" className="viz-axis">{fmt(d)}</text>
            )
          ))}
          {hd && <line x1={x(hover!)} x2={x(hover!)} y1={T} y2={H - B} stroke="var(--text-2)" strokeWidth={1} strokeDasharray="3 3" />}
          {series.map((s) => {
            const pts = s.points.map((p) => [x(dates.indexOf(p.date)), y(p.pct)] as const);
            const d = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
            return (
              <g key={s.engine}>
                {pts.length > 1 && <path d={d} fill="none" stroke="var(--card)" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />}
                {pts.length > 1 && <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
                {pts.map(([px, py], i) => <circle key={i} cx={px} cy={py} r={4} fill={s.color} stroke="var(--card)" strokeWidth={2} />)}
              </g>
            );
          })}
          {ends.map((e) => (
            <text key={e.s.engine} x={W - R + 10} y={e.y + 4} className="viz-label">{e.s.label} {e.last.pct}%</text>
          ))}
        </svg>
        {hd && (
          <div className="viz-tip" style={{ left: `${(x(hover!) / W) * 100}%` }} role="status">
            <strong>{fmt(hd)}</strong>
            {series.map((s) => {
              const p = s.points.find((q) => q.date === hd);
              return <div key={s.engine}><span className="swatch" style={{ background: s.color }} />{s.label}: {p ? `${p.pct}% (${p.n} of ${p.of})` : "—"}</div>;
            })}
          </div>
        )}
      </div>
      <details className="viz-table">
        <summary>Show as a table</summary>
        <table>
          <thead><tr><th scope="col">Day</th>{series.map((s) => <th key={s.engine} scope="col">{s.label}</th>)}</tr></thead>
          <tbody>
            {dates.map((d) => (
              <tr key={d}><th scope="row">{fmt(d)}</th>{series.map((s) => {
                const p = s.points.find((q) => q.date === d);
                return <td key={s.engine}>{p ? `${p.pct}% · ${p.n} of ${p.of}` : "—"}</td>;
              })}</tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
