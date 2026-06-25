// Shared chart + data-viz components
const { useState, useMemo, useEffect, useRef } = React;

// Burndown chart — ideal line vs actual
function Burndown({ data, height = 180, accent = 'var(--accent)', ideal = 'var(--ink-3)', grid = 'var(--border)' }) {
  // data: [{day: 1, actual: 30}, ...], length = sprint days + 1
  const ref = useRef(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(e => setW(e[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const pad = { t: 10, r: 12, b: 22, l: 28 };
  const h = height;
  const maxY = Math.max(...data.map(d => d.actual), data[0]?.actual || 1);
  const x = (i) => pad.l + (i / (data.length - 1)) * (w - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / maxY) * (h - pad.t - pad.b);
  const idealPath = `M ${x(0)} ${y(maxY)} L ${x(data.length - 1)} ${y(0)}`;
  const actualPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.actual)}`).join(' ');
  const areaPath = actualPath + ` L ${x(data.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`;

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg width={w} height={h} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="bdFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={accent} stopOpacity="0.18"/>
            <stop offset="1" stopColor={accent} stopOpacity="0"/>
          </linearGradient>
        </defs>
        {/* grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(p => (
          <line key={p} x1={pad.l} x2={w - pad.r} y1={pad.t + p * (h - pad.t - pad.b)} y2={pad.t + p * (h - pad.t - pad.b)} stroke={grid} strokeDasharray="2 4"/>
        ))}
        {/* y-axis labels */}
        {[0, 0.5, 1].map(p => (
          <text key={p} x={pad.l - 6} y={pad.t + p * (h - pad.t - pad.b) + 3} textAnchor="end" fontSize="10" fill="var(--ink-3)" fontFamily="var(--font-mono)">
            {Math.round(maxY * (1 - p))}
          </text>
        ))}
        {/* ideal */}
        <path d={idealPath} stroke={ideal} strokeWidth="1.25" strokeDasharray="4 4" fill="none"/>
        {/* actual fill + line */}
        <path d={areaPath} fill="url(#bdFill)"/>
        <path d={actualPath} stroke={accent} strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
        {/* dots */}
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.actual)} r={i === data.length - 1 ? 4 : 2.5} fill={accent} stroke="var(--bg-elev)" strokeWidth="1.5"/>
        ))}
        {/* x-axis labels */}
        {[0, Math.floor(data.length/2), data.length-1].map(i => (
          <text key={i} x={x(i)} y={h - 6} textAnchor="middle" fontSize="10" fill="var(--ink-3)" fontFamily="var(--font-mono)">Day {i}</text>
        ))}
      </svg>
    </div>
  );
}

// Velocity bars
function VelocityBars({ data, height = 120, accent = 'var(--accent)' }) {
  // data: [{label: 'S1', value: 28}, ...]
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height, padding: '8px 0' }}>
      {data.map((d, i) => {
        const isLast = i === data.length - 1;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>{d.value}</div>
            <div style={{
              width: '100%',
              height: `${(d.value / max) * (height - 36)}px`,
              background: isLast ? accent : 'var(--border-strong)',
              borderRadius: '3px 3px 0 0',
              minHeight: 4,
            }}/>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// Progress ring
function ProgressRing({ value = 0, size = 48, stroke = 4, accent = 'var(--accent)', track = 'var(--border)' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - value / 100);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} stroke={track} strokeWidth={stroke} fill="none"/>
      <circle cx={size/2} cy={size/2} r={r} stroke={accent} strokeWidth={stroke} fill="none"
              strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.6s' }}/>
    </svg>
  );
}

// Stat tile
function Stat({ label, value, delta, accent = 'var(--ink)', icon = null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.025em', color: accent, lineHeight: 1, fontFamily: 'var(--font-sans)', fontFeatureSettings: "'ss01','cv11'" }}>
        {value}
      </div>
      {delta && <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{delta}</div>}
    </div>
  );
}

// Sparkline
function Sparkline({ data, width = 80, height = 28, color = 'var(--accent)' }) {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i/(data.length-1))*width},${height - ((v-min)/range)*height}`).join(' ');
  return (
    <svg width={width} height={height}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}

// Avatar (monogram)
function Avatar({ name, size = 28, color }) {
  const initial = name ? name.trim()[0].toUpperCase() : '?';
  const hash = name ? name.split('').reduce((a,c) => a + c.charCodeAt(0), 0) : 0;
  const palette = ['#FF6B35','#1B4332','#22577A','#8B5CF6','#DB2777','#0EA5E9','#E11D48','#059669'];
  const bg = color || palette[hash % palette.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg, color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700, letterSpacing: '-0.02em', flexShrink: 0,
      fontFamily: 'var(--font-sans)',
    }}>{initial}</div>
  );
}

window.Charts = { Burndown, VelocityBars, ProgressRing, Stat, Sparkline, Avatar };
