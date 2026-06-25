// ============ V1 Overview · 編輯式儀表板 ============

function V1Overview({ useSerif }) {
  const bd = [
    {day:0,actual:47,ideal:47},{day:1,actual:45,ideal:42.3},{day:2,actual:42,ideal:37.6},
    {day:3,actual:40,ideal:32.9},{day:4,actual:36,ideal:28.2},{day:5,actual:33,ideal:23.5},
    {day:6,actual:30,ideal:18.8},{day:7,actual:29,ideal:14.1},
  ];
  const team = [
    { n: 'Mira Chen', r: 'Scrum Master', l: 60, p: 6, color: '#C96442' },
    { n: 'Jonas Kohler', r: 'Engineer', l: 92, p: 14, color: '#7A6043' },
    { n: 'Aaliyah Reeves', r: 'Designer', l: 78, p: 9, color: '#4F7E5C' },
    { n: 'Felix Duarte', r: 'Engineer', l: 65, p: 11, color: '#3F6B7A' },
    { n: 'Priya Nair', r: 'Product', l: 45, p: 7, color: '#8B5A8E' },
  ];
  const activity = [
    { who: 'Jonas', text: '把「Step 2 引導頁面」搬到 已完成', t: '12 分鐘前' },
    { who: 'Aaliyah', text: '在「活化漏斗」留下了 3 則回饋', t: '34 分鐘前' },
    { who: 'Mira', text: '建立了 PBI · Magic link 備援', t: '1 小時前' },
    { who: 'Felix', text: '把「Onboarding 步驟 3」指派給 Priya', t: '2 小時前' },
    { who: 'Priya', text: '完成了 Welcome 文案修改', t: '3 小時前' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Hero */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Sprint Goal</span>
          <span style={{ height: 1, flex: 1, background: 'var(--border)' }}/>
          <span className="chip chip-accent">進行中 · Day {SPRINT.day}</span>
        </div>
        <h1 style={{
          margin: 0, fontSize: 44, lineHeight: 1.1, letterSpacing: '-0.025em',
          fontWeight: useSerif ? 400 : 600,
          fontFamily: useSerif ? 'var(--font-serif)' : 'var(--font-sans)',
          color: 'var(--ink)', maxWidth: 920,
        }}>
          {useSerif ? <em>{SPRINT.goal}</em> : SPRINT.goal}
        </h1>
        <div style={{ display: 'flex', gap: 28, marginTop: 18, fontSize: 13, color: 'var(--ink-2)' }}>
          <div><span style={{ color: 'var(--ink-3)' }}>團隊 · </span><b style={{ color: 'var(--ink)' }}>5 人</b></div>
          <div><span style={{ color: 'var(--ink-3)' }}>已交付 · </span><b style={{ color: 'var(--ink)' }}>{SPRINT.points.done} / {SPRINT.points.total} 點</b></div>
          <div><span style={{ color: 'var(--ink-3)' }}>剩餘 · </span><b style={{ color: 'var(--ink)' }}>3 天</b></div>
          <div><span style={{ color: 'var(--ink-3)' }}>阻礙 · </span><b style={{ color: 'var(--danger)' }}>2 個</b></div>
        </div>
      </section>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, ...vc() }}>
        {[
          { l: 'PBI 完成', v: '4 / 9', d: '占 44%' },
          { l: '進行中工作', v: '11', d: '↑ 較昨日 +3' },
          { l: '近 5 sprint 速度', v: '37.6', d: '本期 42' },
          { l: 'DoD 達成率', v: '92%', d: '46 / 50 項' },
        ].map((k,i) => (
          <div key={i} style={{ padding: '20px 22px', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
            <div style={metaLbl()}>{k.l}</div>
            <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--ink)', marginTop: 2 }}>{k.v}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{k.d}</div>
          </div>
        ))}
      </div>

      {/* Burndown + Team */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        <div style={vc()}>
          <div style={vch()}>
            <div>
              <div style={vct()}>燃盡圖</div>
              <div style={vcs()}>剩餘故事點 · 實際 vs 理想</div>
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--ink-3)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 2, background: 'var(--accent)' }}/>實際</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 2, background: 'var(--ink-4)', borderTop: '1px dashed' }}/>理想</span>
            </div>
          </div>
          <div style={{ padding: 18 }}><Charts.Burndown data={bd} height={240} accent="var(--accent)" ideal="var(--ink-4)" grid="var(--border)"/></div>
        </div>

        <div style={vc()}>
          <div style={vch()}><div style={vct()}>團隊負載</div></div>
          <div style={{ padding: 8 }}>
            {team.map((m,i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 7, transition: 'background 0.15s' }}>
                <Charts.Avatar name={m.n} size={28}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{m.n}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{m.r} · {m.p}pt</div>
                </div>
                <div style={{ width: 60 }}>
                  <div style={{ height: 4, background: 'var(--bg-sunk)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${m.l}%`, height: '100%', background: m.l > 85 ? 'var(--warn)' : 'var(--accent)' }}/>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', marginTop: 3, textAlign: 'right' }}>{m.l}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two columns: Today's focus + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div style={vc()}>
          <div style={vch()}>
            <div><div style={vct()}>今日重點</div><div style={vcs()}>3 件最重要的事</div></div>
            <button style={vbtn('ghost')}>查看全部</button>
          </div>
          <div style={{ padding: '4px 0' }}>
            {[
              { p: 'PBI-02', t: '完成活化漏斗的事件追蹤埋點', who: 'Jonas', due: '今天', tag: 'P0' },
              { p: 'PBI-01', t: '把 Step 3 表單錯誤訊息整合進設計', who: 'Aaliyah', due: '明天', tag: 'P1' },
              { p: 'PBI-03', t: 'Magic link 法律審核回饋處理', who: 'Priya', due: '週五前', tag: 'P1' },
            ].map((x,i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderTop: '1px solid var(--border)' }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, border: '1.5px solid var(--border-strong)', flexShrink: 0 }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)', padding: '1px 5px', background: 'var(--accent-soft)', borderRadius: 3 }}>{x.p}</span>
                    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-sunk)', color: 'var(--ink-2)', fontWeight: 600 }}>{x.tag}</span>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.4 }}>{x.t}</div>
                </div>
                <Charts.Avatar name={x.who} size={24}/>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', width: 60, textAlign: 'right' }}>{x.due}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={vc()}>
          <div style={vch()}><div style={vct()}>近期動態</div></div>
          <div style={{ padding: '6px 0' }}>
            {activity.map((a,i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 18px', alignItems: 'flex-start' }}>
                <Charts.Avatar name={a.who} size={22}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45 }}>
                    <b style={{ color: 'var(--ink)' }}>{a.who}</b> {a.text}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{a.t}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.V1Overview = V1Overview;
