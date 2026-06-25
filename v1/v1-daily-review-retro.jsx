// ============ V1 Daily / Review / Retro · A & B variants ============

// ───── DAILY A · 編輯感 (timeline + textual standup) ─────
function V1DailyA() {
  const days = Array.from({ length: 10 }, (_, i) => i+1);
  const team = [
    { n: 'Mira Chen', r: 'SM', y: '解開了 Jonas 的卡點；草擬了 retro 議程。', t: '主持下午 4 點的 review 預演。', b: null },
    { n: 'Jonas Kohler', r: 'Eng', y: '完成 Step 2 版型；review 兩個 PR。', t: '串接進度條 + 鍵盤導覽。', b: '等 Aaliyah 動畫規格。' },
    { n: 'Aaliyah Reeves', r: 'Design', y: '完成 Step 2 動畫規格 v4。', t: 'Review Jonas 實作；規格 Step 3。', b: null },
    { n: 'Felix Duarte', r: 'Eng', y: '事件 schema 已合進 main。', t: 'Client 端事件發送。', b: null },
    { n: 'Priya Nair', r: 'Product', y: '完成 5 個空狀態文案草稿。', t: '與成長團隊同步；Step 3 文案。', b: '需要法務審核 magic-link 文案。' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em' }}>每日站會</h1>
        <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Day {SPRINT.day} · 5 月 5 日 週二 · 9:45 – 10:00</span>
      </header>

      <div style={vc()}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><div style={vct()}>Sprint 時間軸</div><div style={vcs()}>{SPRINT.day} / {SPRINT.total} 個站會已完成</div></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={vbtn('ghost')}><Icons.Clock size={12}/> 14:23</button>
            <button style={vbtn('accent')}><Icons.Play size={11}/> 開始計時</button>
          </div>
        </div>
        <div style={{ padding: 16, display: 'flex', gap: 4 }}>
          {days.map(d => {
            const done = d < SPRINT.day, today = d === SPRINT.day;
            return (
              <div key={d} style={{
                flex: 1, padding: '10px 4px', borderRadius: 7, textAlign: 'center',
                background: today ? 'var(--accent)' : done ? 'var(--bg-sunk)' : 'transparent',
                border: `1px solid ${today ? 'var(--accent)' : 'var(--border)'}`,
                color: today ? '#fff' : done ? 'var(--ink-2)' : 'var(--ink-4)',
              }}>
                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, opacity: 0.8 }}>Day</div>
                <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{d}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stand-up cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {team.map((m,i) => (
          <div key={i} style={{ ...vc(), padding: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr 1fr', gap: 0 }}>
              <div style={{ padding: '16px 18px', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-tint)' }}>
                <Charts.Avatar name={m.n} size={32}/>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{m.n}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{m.r}</div>
                </div>
              </div>
              <div style={{ padding: '14px 18px', borderRight: '1px solid var(--border)' }}>
                <div style={metaLbl()}>昨天</div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{m.y}</div>
              </div>
              <div style={{ padding: '14px 18px', borderRight: '1px solid var(--border)' }}>
                <div style={metaLbl()}>今天</div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{m.t}</div>
              </div>
              <div style={{ padding: '14px 18px' }}>
                <div style={metaLbl()}>阻礙</div>
                {m.b ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 8px', borderRadius: 5, background: 'var(--danger-soft)', borderLeft: '2px solid var(--danger)' }}>
                    <div style={{ fontSize: 12, color: 'var(--danger)', lineHeight: 1.45 }}>{m.b}</div>
                  </div>
                ) : <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>—</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───── DAILY B · 高密度表格 ─────
function V1DailyB() {
  const team = [
    { n: 'Mira Chen', r: 'SM', y: '解開了 Jonas 的卡點；草擬 retro 議程', t: '主持 review 預演', b: null, pts: 6 },
    { n: 'Jonas Kohler', r: 'Eng', y: '完成 Step 2 版型；review 兩個 PR', t: '串接進度條', b: '等動畫規格', pts: 14 },
    { n: 'Aaliyah Reeves', r: 'Design', y: '動畫規格 v4 出爐', t: 'Spec Step 3', b: null, pts: 9 },
    { n: 'Felix Duarte', r: 'Eng', y: 'Schema 合進 main', t: '事件發送', b: null, pts: 11 },
    { n: 'Priya Nair', r: 'PM', y: '5 個空狀態文案', t: '成長團隊 sync', b: '法務審核', pts: 7 },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Day 7 / 10</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em' }}>站會記錄</h1>
        </div>
        <button style={vbtn('accent')}><Icons.Play size={11}/> 開始 (15:00)</button>
      </header>
      <div style={vc()}>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr 200px 60px', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-tint)', fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          <div>成員</div><div>昨天</div><div>今天</div><div>阻礙</div><div>點數</div>
        </div>
        {team.map((m,i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr 200px 60px', padding: '12px 16px', borderBottom: i < team.length-1 ? '1px solid var(--border)' : 'none', alignItems: 'center', fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Charts.Avatar name={m.n} size={24}/>
              <div><div style={{ fontWeight: 500 }}>{m.n}</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{m.r}</div></div>
            </div>
            <div style={{ color: 'var(--ink-2)' }}>{m.y}</div>
            <div style={{ color: 'var(--ink)' }}>{m.t}</div>
            <div>{m.b ? <span className="chip" style={{ background: 'var(--danger-soft)', color: 'var(--danger)', border: 'none' }}>{m.b}</span> : <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>—</span>}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{m.pts}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───── REVIEW A · 編輯式議程 ─────
function V1ReviewA({ useSerif }) {
  const sections = [
    { pct: 10, l: '開場', o: 'PO', d: '提醒所有人這次 sprint 的目的，連回業務目標。', s: 'done' },
    { pct: 60, l: '展示', o: '團隊', d: '實際走過 3 步引導流程與事件儀表板。', s: 'doing' },
    { pct: 20, l: '市場與數據', o: 'PO', d: '分享活化漏斗的變化與利害關係人回饋。', s: 'todo' },
    { pct: 10, l: '下一步', o: 'PO', d: '預告下個 sprint 的方向；開放提問。', s: 'todo' },
  ];
  const delivered = [
    { t: 'Step 1 · Welcome 畫面', k: '畫面', pts: 3 },
    { t: 'Step 2 · 工作區設定', k: '流程', pts: 5 },
    { t: '漏斗儀表板 v1', k: '內部工具', pts: 8 },
    { t: '空狀態文案（5 處）', k: '內容', pts: 3 },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 8 }}>Sprint Review · 60 min</div>
        <h1 style={{ margin: 0, fontSize: 36, fontWeight: useSerif ? 400 : 600, letterSpacing: '-0.025em', fontFamily: useSerif ? 'var(--font-serif)' : 'var(--font-sans)', maxWidth: 800 }}>
          {useSerif ? <em>展示</em> : '展示'}我們做出來的成果，<span style={{ color: 'var(--ink-3)' }}>聽利害關係人怎麼說。</span>
        </h1>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        <div style={vc()}>
          <div style={vch()}><div><div style={vct()}>議程</div><div style={vcs()}>12 位與會者</div></div></div>
          <div style={{ padding: '18px 20px 4px' }}>
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
              {sections.map((s,i) => (
                <div key={i} style={{ flex: s.pct, background: s.s === 'done' ? 'var(--success)' : s.s === 'doing' ? 'var(--accent)' : 'var(--bg-sunk)' }}/>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', marginTop: 6 }}>
              <span>0:00</span><span>15:00</span><span>30:00</span><span>45:00</span><span>60:00</span>
            </div>
          </div>
          <div style={{ padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sections.map((s,i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: 14, borderRadius: 8, background: 'var(--bg-tint)', border: '1px solid var(--border)', borderLeft: s.s === 'doing' ? '3px solid var(--accent)' : '1px solid var(--border)' }}>
                <div style={{ width: 50, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: s.s === 'doing' ? 'var(--accent)' : 'var(--ink)' }}>{s.pct}%</div>
                  <div style={{ fontSize: 9, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{Math.round(s.pct*0.6)} 分</div>
                </div>
                <div style={{ width: 1, background: 'var(--border)' }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{s.l}</div>
                    <span className="chip" style={{ fontSize: 10 }}>{s.o}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={vc()}>
            <div style={vch()}><div><div style={vct()}>已交付</div><div style={vcs()}>共 {delivered.reduce((s,d)=>s+d.pts,0)} 點</div></div></div>
            <div style={{ padding: '4px 0' }}>
              {delivered.map((d,i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ width: 18, height: 18, borderRadius: 4, background: 'var(--success)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.Check size={11}/></span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{d.t}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{d.k} · {d.pts}pt</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...vc(), background: 'var(--accent-soft)', borderColor: 'transparent', padding: 18 }}>
            <div style={{ fontSize: 11, color: 'var(--accent-ink)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>活化指標提升</div>
            <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--accent)', marginTop: 4 }}>+18.4%</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }}>首 5 日 cohort vs 上一 sprint 基線</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───── REVIEW B · 簡報模式 ─────
function V1ReviewB() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em' }}>展示記錄</h1>
        <button style={vbtn('accent')}><Icons.Play size={11}/> 進入簡報模式</button>
      </header>
      <div style={{ ...vc(), padding: 28, background: 'var(--ink)', color: 'var(--bg)', minHeight: 360, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>Slide 2 of 6 · 展示</div>
        <div>
          <h2 style={{ margin: 0, fontSize: 56, lineHeight: 1.05, letterSpacing: '-0.03em', fontWeight: 600, fontFamily: 'var(--font-serif)' }}>
            <em>3 步</em>變成 <em>2 步</em>，<br/>首日完成率 +18%。
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 32, fontSize: 13, color: 'var(--ink-4)' }}>
          <div><div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7 }}>Demo by</div><div>Aaliyah · Jonas</div></div>
          <div><div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7 }}>Time</div><div>9 min</div></div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
        {['封面','展示','數據','回饋','待解問題','下一步'].map((t,i) => (
          <div key={i} style={{ ...vc(), padding: 10, fontSize: 11, color: 'var(--ink-3)', display: 'flex', flexDirection: 'column', gap: 4, aspectRatio: '16/10', justifyContent: 'space-between', background: i === 1 ? 'var(--accent-soft)' : 'var(--bg-elev)', borderColor: i === 1 ? 'var(--accent)' : 'var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: i === 1 ? 'var(--accent)' : 'var(--ink-3)' }}>0{i+1}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{t}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───── RETRO A · KSS 看板 ─────
function V1RetroA() {
  const cols = [
    { id: 'keep', l: 'Keep · 繼續做', d: '有效的事，別丟掉', c: 'var(--success)',
      items: [
        { t: 'Slack 異步設計評審比開會快得多。', v: 6 },
        { t: '第一天就埋點，後面決策有依據。', v: 4 },
        { t: '前 48 小時 design + eng pair 開局順暢。', v: 3 },
      ]},
    { id: 'stop', l: 'Stop · 停止做', d: '無效或有害的事', c: 'var(--danger)',
      items: [
        { t: 'PBI-02 中途加碼分析需求 — 範圍蔓延。', v: 5 },
        { t: '阻礙沒先寫，導致站會超時。', v: 4 },
      ]},
    { id: 'start', l: 'Start · 開始做', d: '下個 sprint 的實驗', c: 'var(--accent)',
      items: [
        { t: '站會前先在 #sprint-board 寫好阻礙。', v: 7 },
        { t: '預留 10% 緩衝給途中發現的工作。', v: 5 },
        { t: 'Review 前 24 小時做一次預演。', v: 3 },
      ]},
  ];
  const actions = [
    { who: 'Mira', t: '在每日站會 thread 加入阻礙模板', due: '下 sprint D1' },
    { who: 'Priya', t: '建立範圍變更協議與 PO gate', due: '本週' },
    { who: 'Felix', t: '加入 review 預演的固定行事曆', due: '常態' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 8 }}>Retrospective · Sprint 14</div>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em' }}>留下、停止、開始</h1>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, ...vc() }}>
        {[
          { l: '團隊心情', v: '4.2', s: '/ 5', d: '↑ 0.3 vs 上次' },
          { l: 'DoD 達成', v: '92%', d: '46 / 50' },
          { l: '承諾 vs 交付', v: '81%', d: '2 個 PBI 延期' },
          { l: '阻礙數', v: '7', d: '平均 1.3 天解開' },
        ].map((k,i) => (
          <div key={i} style={{ padding: '16px 20px', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
            <div style={metaLbl()}>{k.l}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em' }}>{k.v}</span>
              {k.s && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{k.s}</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{k.d}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {cols.map(c => (
          <div key={c.id} style={vc()}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.c }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{c.l}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{c.d}</div>
              </div>
              <span className="chip">{c.items.length}</span>
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {c.items.map((it,i) => (
                <div key={i} style={{ padding: 12, borderRadius: 7, background: 'var(--bg-tint)', border: '1px solid var(--border)', display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>{it.t}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Icons.ArrowUp size={12} style={{ color: c.c }}/>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: c.c }}>{it.v}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={vc()}>
        <div style={vch()}><div><div style={vct()}>行動項目</div><div style={vcs()}>下個 sprint 帶走的承諾 — 最多 3 個</div></div></div>
        <div style={{ padding: '4px 0' }}>
          {actions.map((a,i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', width: 24 }}>0{i+1}</div>
              <Charts.Avatar name={a.who} size={26}/>
              <div style={{ flex: 1, fontSize: 13 }}>{a.t}</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{a.due}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ───── RETRO B · 紀錄式時間線 ─────
function V1RetroB() {
  const sprints = [
    { n: 'S14', d: 'Apr 28 – May 9', mood: 4.2, vel: 42, color: 'var(--accent)', current: true },
    { n: 'S13', d: 'Apr 14 – Apr 25', mood: 3.9, vel: 44, color: 'var(--ink-3)' },
    { n: 'S12', d: 'Mar 31 – Apr 11', mood: 3.5, vel: 35, color: 'var(--ink-3)' },
    { n: 'S11', d: 'Mar 17 – Mar 28', mood: 4.1, vel: 42, color: 'var(--ink-3)' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <header><h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em' }}>歷次回顧</h1></header>
      <div style={vc()}>
        {sprints.map((s,i) => (
          <div key={s.n} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 100px 60px', padding: '16px 20px', borderTop: i ? '1px solid var(--border)' : 'none', alignItems: 'center', background: s.current ? 'var(--accent-soft)' : 'transparent' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.current ? 'var(--accent)' : 'var(--ink)' }}>{s.n}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>{s.d}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                {s.current ? '把引導從 3 步減為 2 步，並建立活化儀表板。' : ['Step 4 設計與優化', 'Onboarding 文案 + 法律審核', 'Workspace 模型重構'][i-1]}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>
                {s.current ? '進行中 · Day 7/10' : '已結束 · 3 個行動項目已完成'}
              </div>
            </div>
            <div>
              <div style={metaLbl()}>心情</div>
              <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{s.mood}</div>
            </div>
            <div>
              <div style={metaLbl()}>速度</div>
              <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{s.vel}</div>
            </div>
            <button style={{ ...vbtn('ghost'), padding: '5px 9px', justifySelf: 'end' }}>展開</button>
          </div>
        ))}
      </div>
    </div>
  );
}

window.V1DailyA = V1DailyA;
window.V1DailyB = V1DailyB;
window.V1ReviewA = V1ReviewA;
window.V1ReviewB = V1ReviewB;
window.V1RetroA = V1RetroA;
window.V1RetroB = V1RetroB;
