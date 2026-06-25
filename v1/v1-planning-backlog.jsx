// ============ V1 Planning A/B + Backlog A/B ============

// ───── PLANNING A · 編輯式 (Why/What/How as editorial cards) ─────
function V1PlanningA({ useSerif }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 10 }}>Sprint Planning · Apr 28 – May 9</div>
        <h1 style={{ margin: 0, fontSize: 36, fontWeight: useSerif ? 400 : 600, letterSpacing: '-0.025em', fontFamily: useSerif ? 'var(--font-serif)' : 'var(--font-sans)', maxWidth: 800 }}>
          {useSerif ? <em>為什麼</em> : '為什麼'}做這次 sprint，<span style={{ color: 'var(--ink-3)' }}>我們要交付什麼，</span>以及怎麼一起進行。
        </h1>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          { n: '01', t: '為什麼', sub: '值得做的問題',
            items: ['新用戶在前 5 分鐘流失率 62%。', '活化指標低於 Q1 目標 40%。', '客服票根集中在「不知道下一步要做什麼」。'],
            color: 'var(--ink)',
          },
          { n: '02', t: '要做什麼', sub: 'Product Backlog Items',
            items: ['重新設計 3 步引導流程（8 點）','加入進度條與「跳過」按鈕（5 點）','活化漏斗事件埋點（13 點）','空狀態文案改寫（3 點）'],
            color: 'var(--accent)', accent: true,
          },
          { n: '03', t: '怎麼做', sub: '工作協議',
            items: ['前 48 小時設計+工程一起 pair','沿用既有的 shadcn/ui 元件','埋點先行，第一天就能量測','Slack 異步設計評審'],
            color: 'var(--accent-2)',
          },
        ].map((c,i) => (
          <div key={i} style={{ ...vc(), boxShadow: c.accent ? `0 0 0 1px var(--accent), 0 8px 22px -14px ${c.color}` : 'none' }}>
            <div style={vch()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 6, background: c.accent ? 'var(--accent)' : 'var(--bg-sunk)', color: c.accent ? '#fff' : 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{c.n}</div>
                <div>
                  <div style={vct()}>{c.t}</div>
                  <div style={vcs()}>{c.sub}</div>
                </div>
              </div>
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {c.items.map((x,j) => (
                <div key={j} style={{ padding: '10px 12px', background: 'var(--bg-sunk)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{x}</div>
              ))}
              <button style={{ padding: '8px 10px', borderRadius: 6, fontSize: 12, color: 'var(--ink-3)', border: '1px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Icons.Plus size={11}/> 新增一項
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* DoD */}
      <div style={vc()}>
        <div style={vch()}>
          <div><div style={vct()}>Definition of Done</div><div style={vcs()}>每個 PBI 完成前必須通過的檢查</div></div>
          <span className="chip">6 項</span>
        </div>
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {[
            '兩位工程師完成 code review',
            '單元 + 整合測試在 CI 通過',
            '無新增 a11y 違規（axe 滿分）',
            'Feature flag + release notes 更新',
            'Staging 埋點驗證通過',
            'Aaliyah 完成設計 QA',
          ].map((x,i) => (
            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-sunk)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                <Icons.Check size={11}/>
              </span>
              <span style={{ fontSize: 13, color: 'var(--ink)' }}>{x}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ───── PLANNING B · 表格式 (高密度) ─────
function V1PlanningB() {
  const items = [
    { id: 1, why: '降低首日流失率', pbi: '重新設計 3 步引導流程', est: 8, owner: 'Aaliyah', risk: 'Med' },
    { id: 2, why: '降低首日流失率', pbi: '加入進度條與跳過按鈕', est: 5, owner: 'Jonas', risk: 'Low' },
    { id: 3, why: '建立可量測基線', pbi: '活化漏斗事件埋點', est: 13, owner: 'Felix', risk: 'High' },
    { id: 4, why: '降低支援負擔', pbi: '空狀態文案改寫', est: 3, owner: 'Priya', risk: 'Low' },
    { id: 5, why: '提升轉換', pbi: 'A/B 測試 magic-link vs 密碼', est: 8, owner: 'Felix', risk: 'Med' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 6 }}>Sprint 14 · 規劃</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: '-0.025em' }}>計畫表</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={vbtn('ghost')}><Icons.Sparkle size={12}/> AI 草擬</button>
          <button style={vbtn('primary')}><Icons.Plus size={12}/> 新增 PBI</button>
        </div>
      </header>

      <div style={vc()}>
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 2fr 70px 130px 80px', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-tint)', fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          <div>#</div><div>為什麼</div><div>PBI</div><div>點數</div><div>負責人</div><div>風險</div>
        </div>
        {items.map((x,i) => (
          <div key={x.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 2fr 70px 130px 80px', padding: '12px 16px', borderBottom: i < items.length-1 ? '1px solid var(--border)' : 'none', alignItems: 'center', fontSize: 13 }}>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{String(i+1).padStart(2,'0')}</div>
            <div style={{ color: 'var(--ink-2)' }}>{x.why}</div>
            <div style={{ fontWeight: 500, color: 'var(--ink)' }}>{x.pbi}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{x.est}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Charts.Avatar name={x.owner} size={20}/><span style={{ fontSize: 12 }}>{x.owner}</span>
            </div>
            <div>
              <span className={x.risk === 'High' ? 'chip' : 'chip'} style={{
                background: x.risk === 'High' ? 'var(--danger-soft)' : x.risk === 'Med' ? 'var(--warn-soft)' : 'var(--success-soft)',
                color: x.risk === 'High' ? 'var(--danger)' : x.risk === 'Med' ? 'var(--warn)' : 'var(--success)',
                border: 'none',
              }}>{x.risk}</span>
            </div>
          </div>
        ))}
        <div style={{ padding: '10px 16px', background: 'var(--bg-tint)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-2)' }}>
          <span>合計 {items.length} 項</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>共 {items.reduce((s,x)=>s+x.est,0)} 點 · 上限 47 點</span>
        </div>
      </div>
    </div>
  );
}

// ───── BACKLOG A · 看板 ─────
function V1BacklogA() {
  const pbis = [
    { id: 1, code: 'PBI-01', title: '重新設計 3 步引導流程', pts: 8, prio: 'P0',
      tasks: [
        { id: 1, status: 'done', t: '檢視現有引導指標', who: 'Priya', h: 3 },
        { id: 2, status: 'done', t: '草擬 3 種版面', who: 'Aaliyah', h: 6 },
        { id: 3, status: 'doing', t: '實作 Step 2 工作區設定', who: 'Jonas', h: 8 },
        { id: 4, status: 'todo', t: '串接進度條', who: 'Felix', h: 4 },
      ]},
    { id: 2, code: 'PBI-02', title: '活化漏斗事件埋點', pts: 13, prio: 'P0',
      tasks: [
        { id: 5, status: 'doing', t: '定義事件 schema', who: 'Felix', h: 4 },
        { id: 6, status: 'todo', t: 'Client 端事件發送', who: 'Jonas', h: 6 },
        { id: 7, status: 'todo', t: '漏斗儀表板', who: 'Felix', h: 10 },
      ]},
    { id: 3, code: 'PBI-03', title: '空狀態文案改寫', pts: 3, prio: 'P1',
      tasks: [
        { id: 8, status: 'done', t: '草擬 5 個畫面文案', who: 'Priya', h: 3 },
        { id: 9, status: 'doing', t: '與 Mira 文案 review', who: 'Mira', h: 1 },
      ]},
  ];
  const cols = [
    { id: 'todo', l: '待辦', c: 'var(--ink-3)' },
    { id: 'doing', l: '進行中', c: 'var(--accent)' },
    { id: 'done', l: '完成', c: 'var(--success)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em' }}>Sprint Backlog</h1>
        <div style={{ flex: 1 }}/>
        <button style={vbtn('ghost')}><Icons.Filter size={12}/> 篩選</button>
        <button style={vbtn('primary')}><Icons.Plus size={12}/> 新增任務</button>
      </header>

      <div style={vc()}>
        <div style={{ display: 'grid', gridTemplateColumns: '280px repeat(3, 1fr)', borderBottom: '1px solid var(--border)', background: 'var(--bg-tint)' }}>
          <div style={{ padding: '12px 16px', fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, borderRight: '1px solid var(--border)' }}>Product Backlog Item</div>
          {cols.map(c => (
            <div key={c.id} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, borderRight: c.id !== 'done' ? '1px solid var(--border)' : 'none' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.c }}/>
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: 'var(--ink-2)' }}>{c.l}</span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', marginLeft: 'auto' }}>
                {pbis.flatMap(p => p.tasks).filter(t => t.status === c.id).length}
              </span>
            </div>
          ))}
        </div>
        {pbis.map((pbi, pi) => (
          <div key={pbi.id} style={{ display: 'grid', gridTemplateColumns: '280px repeat(3, 1fr)', borderBottom: pi < pbis.length-1 ? '1px solid var(--border)' : 'none', minHeight: 160, alignItems: 'stretch' }}>
            <div style={{ padding: 16, borderRight: '1px solid var(--border)', background: 'var(--bg-tint)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', padding: '2px 6px', background: 'var(--accent-soft)', borderRadius: 3 }}>{pbi.code}</span>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 3, background: pbi.prio === 'P0' ? 'var(--danger-soft)' : 'var(--warn-soft)', color: pbi.prio === 'P0' ? 'var(--danger)' : 'var(--warn)' }}>{pbi.prio}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>{pbi.title}</div>
              <div style={{ marginTop: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                  <span>{pbi.tasks.filter(t => t.status === 'done').length}/{pbi.tasks.length} tasks</span>
                  <span>{pbi.pts}pt</span>
                </div>
                <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(pbi.tasks.filter(t => t.status === 'done').length/pbi.tasks.length)*100}%`, height: '100%', background: 'var(--accent)' }}/>
                </div>
              </div>
            </div>
            {cols.map(c => (
              <div key={c.id} style={{ padding: 10, borderRight: c.id !== 'done' ? '1px solid var(--border)' : 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pbi.tasks.filter(t => t.status === c.id).map(t => (
                  <div key={t.id} style={{ padding: '10px 12px', borderRadius: 7, background: 'var(--bg-elev)', border: '1px solid var(--border)', borderLeft: c.id === 'doing' ? '3px solid var(--accent)' : '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4, marginBottom: 8 }}>{t.t}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Charts.Avatar name={t.who} size={18}/>
                        <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{t.who}</span>
                      </div>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{t.h}h</span>
                    </div>
                  </div>
                ))}
                {pbi.tasks.filter(t => t.status === c.id).length === 0 && (
                  <div style={{ flex: 1, border: '1px dashed var(--border-strong)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)', fontSize: 11, minHeight: 60 }}>—</div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ───── BACKLOG B · 表格 ─────
function V1BacklogB() {
  const tasks = [
    { p: 'PBI-01', t: '檢視現有引導指標', s: 'done', who: 'Priya', h: 3, due: 'Apr 28' },
    { p: 'PBI-01', t: '草擬 3 種版面', s: 'done', who: 'Aaliyah', h: 6, due: 'Apr 30' },
    { p: 'PBI-01', t: '實作 Step 2 工作區設定', s: 'doing', who: 'Jonas', h: 8, due: 'May 5' },
    { p: 'PBI-01', t: '串接進度條', s: 'todo', who: 'Felix', h: 4, due: 'May 6' },
    { p: 'PBI-02', t: '定義事件 schema', s: 'doing', who: 'Felix', h: 4, due: 'May 4' },
    { p: 'PBI-02', t: 'Client 端事件發送', s: 'todo', who: 'Jonas', h: 6, due: 'May 7' },
    { p: 'PBI-02', t: '漏斗儀表板', s: 'todo', who: 'Felix', h: 10, due: 'May 9' },
    { p: 'PBI-03', t: '草擬 5 個畫面文案', s: 'done', who: 'Priya', h: 3, due: 'Apr 29' },
    { p: 'PBI-03', t: '與 Mira 文案 review', s: 'doing', who: 'Mira', h: 1, due: 'May 5' },
  ];
  const sLbl = { todo: '待辦', doing: '進行中', done: '完成' };
  const sCol = { todo: 'var(--ink-3)', doing: 'var(--accent)', done: 'var(--success)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em' }}>所有任務</h1>
        <div style={{ flex: 1 }}/>
        <span className="chip">{tasks.length} 項任務</span>
        <button style={vbtn('primary')}><Icons.Plus size={12}/> 新增</button>
      </header>
      <div style={vc()}>
        <div style={{ display: 'grid', gridTemplateColumns: '24px 90px 2fr 80px 130px 60px 90px', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-tint)', fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          <div></div><div>PBI</div><div>任務</div><div>狀態</div><div>負責人</div><div>工時</div><div>截止</div>
        </div>
        {tasks.map((x,i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px 90px 2fr 80px 130px 60px 90px', padding: '10px 16px', borderBottom: i < tasks.length-1 ? '1px solid var(--border)' : 'none', alignItems: 'center', fontSize: 13 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, border: x.s === 'done' ? '0' : '1.5px solid var(--border-strong)', background: x.s === 'done' ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              {x.s === 'done' && <Icons.Check size={9}/>}
            </div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)' }}>{x.p}</div>
            <div style={{ color: 'var(--ink)', textDecoration: x.s === 'done' ? 'line-through' : 'none', textDecorationColor: 'var(--ink-4)' }}>{x.t}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: sCol[x.s] }}/>
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{sLbl[x.s]}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Charts.Avatar name={x.who} size={20}/><span style={{ fontSize: 12 }}>{x.who}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{x.h}h</div>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{x.due}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.V1PlanningA = V1PlanningA;
window.V1PlanningB = V1PlanningB;
window.V1BacklogA = V1BacklogA;
window.V1BacklogB = V1BacklogB;
