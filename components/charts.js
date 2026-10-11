'use client';

// Hand-drawn SVG and CSS charts. No libraries, no keys needed.
// Everything here reads CSS variables, so it follows light and dark mode.

// A month of daily closes, oldest first. Green when the month is up, red when down.
export function Sparkline({ series, positive, width = 240, height = 60 }) {
  if (!series || series.length < 2) return null;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const stepX = width / (series.length - 1);
  const pts = series.map((v, i) => [
    i * stepX,
    height - 5 - ((v - min) / span) * (height - 10),
  ]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <span className={`spark-wrap ${positive ? 'up' : 'down'}`}>
      <svg
        className="spark"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Price over the last month, ${positive ? 'up' : 'down'} overall`}
      >
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last[0]} cy={last[1]} r="3.5" fill="currentColor" />
      </svg>
    </span>
  );
}

// Prediction-market odds as horizontal percentage bars.
export function OddsBars({ outcomes }) {
  return (
    <div className="odds">
      {(outcomes || []).map((o) => {
        const pct = Math.max(0, Math.min(100, parseFloat(o.chance) || 0));
        return (
          <div key={o.label} className="odd-row">
            <span className="odd-label">{o.label}</span>
            <div className="odd-track" role="img" aria-label={`${o.label}: ${o.chance}`}>
              <div className="odd-fill" style={{ width: `${pct}%` }} />
            </div>
            <b className="odd-pct">{o.chance}</b>
          </div>
        );
      })}
    </div>
  );
}

// Horizontal bars for the impact-map overview: one row per disruption.
export function MapBars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="hbars" role="img" aria-label="Chains per kind of disruption">
      {rows.map((r) => (
        <div key={r.label} className="hbar-row">
          <span className="hbar-label">{r.label}</span>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
          <b className="hbar-value">{r.value}</b>
        </div>
      ))}
    </div>
  );
}
