// "Stamped meter" (SPEC §4): a half-dial for one share, with the count beside the percentage so it is never a bare number.
export function Meter({ pct, n, of, label }: { pct: number | null; n?: number; of?: number; label: string }) {
  const r = 80, cx = 100, cy = 96, sw = 14;
  const arc = (p: number) => {
    const a = Math.PI * (1 - p / 100);
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  };
  const end = arc(pct ?? 0);
  const large = 0; // half circle never exceeds 180°
  return (
    <figure className="meter" aria-label={pct == null ? `${label}: no data yet` : `${label}: ${pct}% — ${n} of ${of} answers`}>
      <svg viewBox="0 0 200 112" role="img" aria-hidden="true">
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="var(--hairline)" strokeWidth={sw} strokeLinecap="round" />
        {pct != null && pct > 0 && (
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`} fill="none" stroke="var(--coral)" strokeWidth={sw} strokeLinecap="round" />
        )}
        {[0, 25, 50, 75, 100].map((t) => {
          const a = Math.PI * (1 - t / 100);
          const o = { x: cx + (r + 12) * Math.cos(a), y: cy - (r + 12) * Math.sin(a) };
          const i = { x: cx + (r + 6) * Math.cos(a), y: cy - (r + 6) * Math.sin(a) };
          return <line key={t} x1={i.x} y1={i.y} x2={o.x} y2={o.y} stroke="var(--text-2)" strokeWidth={1.5} />;
        })}
      </svg>
      <figcaption>
        <span className="stat">{pct == null ? <span className="blank">—</span> : `${pct}%`}</span>
        <span className="small muted">{pct == null ? "No completed run yet" : `${n} of ${of} answers name you`}</span>
      </figcaption>
    </figure>
  );
}
