// ============ V1 — Notion-warm App Shell ============
const { useState, useMemo } = React;

// Card / button helpers used across pages
function vc() { return { background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }; }
function vch() { return { padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }; }
function vct() { return { fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }; }
function vcs() { return { fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }; }
function metaLbl() { return { fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4 }; }
function vbtn(variant) {
  const base = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, transition: 'all 0.15s' };
  if (variant === 'primary') return { ...base, background: 'var(--ink)', color: 'var(--bg)', boxShadow: '0 1px 0 rgba(0,0,0,0.05)' };
  if (variant === 'accent') return { ...base, background: 'var(--accent)', color: '#fff' };
  if (variant === 'ghost') return { ...base, color: 'var(--ink-2)', border: '1px solid var(--border)', background: 'var(--bg-elev)' };
  return { ...base, color: 'var(--ink-2)' };
}

window.vc = vc; window.vch = vch; window.vct = vct; window.vcs = vcs; window.metaLbl = metaLbl; window.vbtn = vbtn;

const SPRINT = {
  name: 'Atlas — Sprint 14',
  goal: '把新用戶的引導流程從 3 步減為 2 步，並把活化指標放上即時儀表板。',
  day: 7, total: 10, points: { done: 18, total: 47 },
  team: ['Mira Chen','Jonas Kohler','Aaliyah Reeves','Felix Duarte','Priya Nair'],
};

function V1App() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "primaryColor": "#C96442",
    "density": "regular",
    "fontWeight": 500,
    "useSerifHeadings": true,
    "showVariantB": false
  }/*EDITMODE-END*/;

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [page, setPage] = useState('overview');

  const densityScale = t.density === 'compact' ? 0.85 : t.density === 'cozy' ? 1.15 : 1;

  const themeStyle = {
    '--accent': t.primaryColor,
    '--accent-soft': hexAlpha(t.primaryColor, 0.12),
    '--accent-ink': shade(t.primaryColor, -25),
    '--density': densityScale,
    '--weight': t.fontWeight,
  };

  const nav = [
    { id: 'overview', label: '總覽', en: 'Overview' },
    { id: 'planning', label: '規劃', en: 'Planning', n: '01' },
    { id: 'backlog',  label: '待辦', en: 'Backlog', n: '02' },
    { id: 'daily',    label: '每日站會', en: 'Daily', n: '03' },
    { id: 'review',   label: '審視會', en: 'Review', n: '04' },
    { id: 'retro',    label: '回顧', en: 'Retro', n: '05' },
  ];

  return (
    <div className="scrum-app" style={{ ...themeStyle, fontWeight: t.fontWeight, minHeight: 900 }}>
      {/* Top nav */}
      <header style={{
        borderBottom: '1px solid var(--border)', background: 'var(--bg-elev)',
        padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 18,
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 500 }}>e</div>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.015em' }}>Ember</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', paddingLeft: 12, marginLeft: 4, borderLeft: '1px solid var(--border)' }}>{SPRINT.name}</div>
        </div>
        <nav style={{ display: 'flex', gap: 1, marginLeft: 16 }}>
          {nav.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{
              padding: '6px 11px', borderRadius: 6, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6,
              fontWeight: page === n.id ? 600 : 500,
              color: page === n.id ? 'var(--ink)' : 'var(--ink-2)',
              background: page === n.id ? 'var(--bg-sunk)' : 'transparent',
            }}>
              {n.n && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: page === n.id ? 'var(--accent)' : 'var(--ink-4)' }}>{n.n}</span>}
              {n.label}
            </button>
          ))}
        </nav>
        <div style={{ flex: 1 }}/>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>Day {SPRINT.day}/{SPRINT.total}</div>
        <div style={{ width: 100, height: 4, background: 'var(--bg-sunk)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${(SPRINT.day/SPRINT.total)*100}%`, height: '100%', background: 'var(--accent)' }}/>
        </div>
        <Charts.Avatar name="Mira Chen" size={26}/>
      </header>

      {/* Variant tabs */}
      {page !== 'overview' && (
        <div style={{ background: 'var(--bg-tint)', borderBottom: '1px solid var(--border)', padding: '8px 28px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
          <span style={{ color: 'var(--ink-3)' }}>變體</span>
          <div style={{ display: 'flex', gap: 2, padding: 2, background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 7 }}>
            <button onClick={() => setTweak('showVariantB', false)} style={{
              padding: '4px 10px', borderRadius: 5, fontSize: 12, fontWeight: 500,
              background: !t.showVariantB ? 'var(--bg-sunk)' : 'transparent',
              color: !t.showVariantB ? 'var(--ink)' : 'var(--ink-3)',
            }}>A · 編輯式</button>
            <button onClick={() => setTweak('showVariantB', true)} style={{
              padding: '4px 10px', borderRadius: 5, fontSize: 12, fontWeight: 500,
              background: t.showVariantB ? 'var(--bg-sunk)' : 'transparent',
              color: t.showVariantB ? 'var(--ink)' : 'var(--ink-3)',
            }}>B · 表格式</button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
            {t.showVariantB ? '高密度資訊版' : '編輯感、留白較多'}
          </div>
        </div>
      )}

      <div style={{ padding: '28px 32px 60px', maxWidth: 1280, margin: '0 auto' }}>
        {page === 'overview' && <V1Overview useSerif={t.useSerifHeadings}/>}
        {page === 'planning' && (t.showVariantB ? <V1PlanningB/> : <V1PlanningA useSerif={t.useSerifHeadings}/>)}
        {page === 'backlog' && (t.showVariantB ? <V1BacklogB/> : <V1BacklogA/>)}
        {page === 'daily' && (t.showVariantB ? <V1DailyB/> : <V1DailyA/>)}
        {page === 'review' && (t.showVariantB ? <V1ReviewB/> : <V1ReviewA useSerif={t.useSerifHeadings}/>)}
        {page === 'retro' && (t.showVariantB ? <V1RetroB/> : <V1RetroA/>)}
      </div>

      <TweaksPanel title="Ember · Tweaks">
        <TweakSection label="Theme"/>
        <TweakColor label="強調色" value={t.primaryColor} onChange={(v) => setTweak('primaryColor', v)}/>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: -4 }}>
          {['#C96442','#7A6043','#4F7E5C','#3F6B7A','#8B5A8E','#1F1D17'].map(c => (
            <button key={c} onClick={() => setTweak('primaryColor', c)} style={{
              width: 22, height: 22, borderRadius: 5, background: c, cursor: 'pointer',
              border: t.primaryColor === c ? '2px solid var(--ink)' : '1px solid rgba(0,0,0,0.1)',
            }}/>
          ))}
        </div>
        <TweakSection label="Layout"/>
        <TweakRadio label="密度" value={t.density} options={['compact','regular','cozy']} onChange={(v) => setTweak('density', v)}/>
        <TweakSlider label="字重" value={t.fontWeight} min={300} max={600} step={50} onChange={(v) => setTweak('fontWeight', v)}/>
        <TweakSection label="Typography"/>
        <TweakToggle label="標題用襯線斜體" value={t.useSerifHeadings} onChange={(v) => setTweak('useSerifHeadings', v)}/>
      </TweaksPanel>
    </div>
  );
}

// helpers
function hexAlpha(hex, a) {
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}
function shade(hex, percent) {
  const h = hex.replace('#','');
  let r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
  const k = percent / 100;
  r = Math.round(k < 0 ? r * (1+k) : r + (255-r)*k);
  g = Math.round(k < 0 ? g * (1+k) : g + (255-g)*k);
  b = Math.round(k < 0 ? b * (1+k) : b + (255-b)*k);
  return `rgb(${r},${g},${b})`;
}

window.V1App = V1App;
