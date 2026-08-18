// ── 工作日誌產生：共用模組（純函式，不綁定任何 Firebase SDK）──
// 重點：文字內容一律「依傳入的日期」即時產生，不是烤好的快照。
// 資料讀取交由呼叫端提供 readSprint（cron 用 Admin SDK、前端可用 Client SDK）。

export interface SprintDoc { name?: string; planning?: Record<string, unknown>; backlog?: Record<string, unknown>; daily?: Record<string, unknown> }
export type ReadSprint = (id: string) => Promise<SprintDoc | null>;

export interface JEntry { name: string; role: string; q1: string; q2: string; q3: string }
export interface JDay { idx: number; date: string; isoDate: string; dow: string; done: boolean; entries: JEntry[] }
export interface JPersonLoad { name: string; role: string; assigned: number; capacity: number; loadPct: number }
export interface JSprintData { name: string; goal: string; totalDays: number; completionPct: number; workloads: JPersonLoad[]; days: JDay[] }
export interface JournalRawData { allData: JSprintData[]; loadLines: string[]; headerMeta: string }

export const WEEKDAYS_J_MOD = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

// ── Sprint 是否「進行中」──
// 首頁的預設勾選與 LINE 定時推播共用這一份判斷。兩邊各寫一份的話，就會出現
// 「畫面上明明三個在跑、LINE 回報卻只有兩個」這種對不起來的狀況。
export interface SprintProgressInput {
  sprintStatus?: string;
  totalTasks: number;
  todo: number;
  doing: number;
  startDate?: string;
  endDate?: string;
}

export function isSprintInProgress(x: SprintProgressInput, todayIso: string): boolean {
  if (x.sprintStatus === 'in-progress') return true;
  if (x.sprintStatus === 'completed' || x.sprintStatus === 'pending') return false;
  if (x.totalTasks > 0 && x.todo === 0 && x.doing === 0) return false; // 有任務且全部完成
  if (x.doing > 0) return true;
  // 全是待辦、或還沒建任何任務：用日期範圍判斷。
  // 「還沒建任務」不能直接判定成非進行中——剛開的 Sprint 本來就還沒拆任務，
  // 但它今天確實在跑，該出現在回報裡（只是內容顯示「尚無紀錄」）。
  if (x.startDate && x.endDate) return todayIso >= x.startDate && todayIso <= x.endDate;
  return true;
}

// 從整份 sprint 文件推出判斷所需欄位。cron 端沒有前端 dashboards 那份快取，
// 計法必須與 page.tsx 的 dashboard 一致：只算屬於現存 PBI 的任務（排除孤兒任務）。
export function sprintProgressFromDoc(doc: SprintDoc & { sprintStatus?: string }): SprintProgressInput {
  const backlog = (doc.backlog || {}) as Record<string, unknown>;
  const planning = (doc.planning || {}) as Record<string, unknown>;
  const tasks = (Array.isArray(backlog.tasks) ? backlog.tasks : []) as Record<string, unknown>[];
  const pbiIds = new Set(tasks.filter(t => t.status === 'pbi').map(t => t.id));
  const real = tasks.filter(t => t.type === 'task' && t.pbiId && pbiIds.has(t.pbiId));
  const startDate = typeof planning.startDate === 'string' ? planning.startDate : '';
  const sprintDays = Number(backlog.sprintDays ?? 0);
  let endDate = '';
  if (startDate && sprintDays > 0) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + sprintDays - 1);
    endDate = d.toISOString().slice(0, 10);
  }
  return {
    sprintStatus: doc.sprintStatus,
    totalTasks: real.length,
    todo: real.filter(t => t.status === 'todo').length,
    doing: real.filter(t => t.status === 'doing').length,
    startDate,
    endDate,
  };
}

const DIVIDER_HEAVY = '══════════════════════════════';
const DIVIDER_LIGHT = '──────────────────────────────';

export function jGetNote(map: Record<number, unknown>, day: number, person: string): string {
  const v = map[day];
  if (!v || typeof v === 'string') return '';
  return (v as Record<string, string>)[person] || '';
}

export function jDays(tl: unknown): number {
  if (tl === '30d') return 30;
  const n = Number(tl);
  return Number.isFinite(n) && n > 0 ? n * 7 : 30;
}

export function buildDailyText(raw: JournalRawData, isoDate: string): string {
  const DOW = WEEKDAYS_J_MOD;
  const d = new Date(isoDate);
  const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
  const displayDate = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${DOW[d.getDay()]}）`;
  const sprintNames = raw.allData.map(s => s.name).join('、');
  const dl: string[] = [
    `📋 工作日報  ${displayDate}`,
    `Sprint：${sprintNames}`,
    DIVIDER_HEAVY,
  ];

  if (raw.loadLines.length > 0) {
    dl.push('');
    dl.push('👥 人員總負荷');
    raw.loadLines.forEach(l => dl.push(`• ${l.trim()}`));
  }

  for (const s of raw.allData) {
    dl.push('');
    dl.push(`▌ ${s.name}  ·  完成率 ${s.completionPct}%`);
    if (s.goal) dl.push(`🎯 Sprint Goal：${s.goal}`);
    dl.push(DIVIDER_LIGHT);

    const todayDays = s.days.filter(day => day.isoDate === isoDate || (!day.isoDate && day.date === dateStr));
    if (todayDays.length === 0) {
      dl.push(`  （${dateStr} 尚無 Daily Scrum 紀錄）`);
      dl.push(DIVIDER_HEAVY);
      continue;
    }

    for (const day of todayDays) {
      dl.push(`  ${day.done ? '✅' : '○'} Day ${day.idx + 1}/${s.totalDays}   ${day.date} ${day.dow}`);
      const activeEntries = day.entries.filter(e => e.q1 || e.q2 || e.q3);
      if (activeEntries.length === 0) { dl.push('  （本日站會完成，無文字記錄）'); continue; }
      activeEntries.forEach(e => {
        dl.push('');
        dl.push(`  👤 ${e.name}${e.role ? `（${e.role}）` : ''}`);
        if (e.q1) {
          dl.push('  ▸ 昨天完成');
          e.q1.split('\n').forEach(line => dl.push(`    ${line}`));
        }
        if (e.q2) {
          dl.push('  ▸ 今天計劃');
          e.q2.split('\n').forEach(line => dl.push(`    ${line}`));
        }
        if (e.q3) {
          dl.push('  ▸ 阻礙事項');
          e.q3.split('\n').forEach(line => dl.push(`    ${line}`));
        }
      });
    }
    dl.push('');
    dl.push(DIVIDER_HEAVY);
  }

  return dl.join('\n');
}

export function buildWeeklyText(raw: JournalRawData, rangeFrom: string, rangeTo: string): string {
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };
  const rangeStr = rangeFrom || rangeTo
    ? `${rangeFrom ? fmtDate(rangeFrom) : '（起始）'} — ${rangeTo ? fmtDate(rangeTo) : '（迄今）'}`
    : '全部';
  const sprintNames = raw.allData.map(s => s.name).join('、');
  const wl: string[] = [
    `📋 工作週報  ${rangeStr}`,
    `Sprint：${sprintNames}`,
    DIVIDER_HEAVY,
  ];

  if (raw.loadLines.length > 0) {
    wl.push('');
    wl.push('👥 人員總負荷');
    raw.loadLines.forEach(l => wl.push(`• ${l.trim()}`));
  }

  for (const s of raw.allData) {
    wl.push('');
    wl.push(`▌ ${s.name}  ·  完成率 ${s.completionPct}%`);
    if (s.goal) wl.push(`🎯 Sprint Goal：${s.goal}`);
    wl.push(DIVIDER_LIGHT);

    const filtered = s.days.filter(day => {
      if (!rangeFrom && !rangeTo) return true;
      if (!day.isoDate) return true;
      if (rangeFrom && day.isoDate < rangeFrom) return false;
      if (rangeTo && day.isoDate > rangeTo) return false;
      return true;
    });

    if (filtered.length === 0) {
      wl.push('  （所選區間無紀錄）');
      wl.push(DIVIDER_HEAVY);
      continue;
    }

    const maxIdx = Math.max(...filtered.map(d => d.idx));
    const numWeeks = Math.ceil((maxIdx + 1) / 7);
    for (let w = 0; w < numWeeks; w++) {
      const weekDays = filtered.filter(d => d.idx >= w * 7 && d.idx < (w + 1) * 7);
      if (weekDays.length === 0) continue;
      const wStart = weekDays[0]; const wEnd = weekDays[weekDays.length - 1];
      const wRange = wStart.date
        ? `${wStart.date} ${wStart.dow} — ${wEnd.date} ${wEnd.dow}`
        : `Day ${w * 7 + 1} — Day ${Math.min((w + 1) * 7, maxIdx + 1)}`;

      wl.push('');
      wl.push(`  📅 第 ${w + 1} 週   ${wRange}`);

      const personNames = Array.from(new Set(weekDays.flatMap(d => d.entries.map(e => e.name))));
      for (const name of personNames) {
        const pDays = weekDays
          .map(d => ({ ...d, e: d.entries.find(e => e.name === name) || { name, role: '', q1: '', q2: '', q3: '' } }))
          .filter(d => d.e.q1 || d.e.q2 || d.e.q3);
        if (pDays.length === 0) continue;
        const personRole = pDays[0]?.e?.role || '';

        wl.push('');
        wl.push(`  👤 ${name}${personRole ? `（${personRole}）` : ''}`);

        const accs = pDays.filter(d => d.e.q1);
        if (accs.length > 0) {
          wl.push('  📝 本週完成');
          accs.forEach(d => {
            const label = d.date ? `${d.date} (${d.dow})` : `Day ${d.idx + 1}/${s.totalDays}`;
            d.e.q1.split('\n').forEach((line, li) => wl.push(`    ${li === 0 ? `${label}：` : '　　　　'}${line}`));
          });
        }
        const lastQ2 = [...pDays].reverse().find(d => d.e.q2);
        if (lastQ2) {
          wl.push('  🎯 下週計劃');
          lastQ2.e.q2.split('\n').forEach(line => wl.push(`    ${line}`));
        }
        const imps = pDays.filter(d => d.e.q3 && d.e.q3 !== '無');
        if (imps.length > 0) {
          wl.push('  ⚠️ 本週阻礙');
          imps.forEach(d => {
            const label = d.date ? `${d.date} (${d.dow})` : `Day ${d.idx + 1}/${s.totalDays}`;
            d.e.q3.split('\n').forEach((line, li) => wl.push(`    ${li === 0 ? `${label}：` : '　　　　'}${line}`));
          });
        } else {
          wl.push('  ⚠️ 本週阻礙：無');
        }
      }
    }
    wl.push('');
    wl.push(DIVIDER_HEAVY);
  }

  return wl.join('\n');
}

const parseHrs = (t: string) => {
  if (!t) return 0;
  const s = t.trim().toLowerCase();
  if (s.endsWith('d')) return (parseFloat(s) || 0) * 8;
  if (s.endsWith('h')) return parseFloat(s) || 0;
  if (s.endsWith('m')) return (parseFloat(s) || 0) / 60;
  return parseFloat(s) || 0;
};

// 由呼叫端提供的 readSprint 讀取指定 sprint 的原始資料，組成 JournalRawData。
// 與前端 handleExportJournal 的組裝邏輯一致（完成率直接由 backlog 任務計算，
// 與 dashboards 相同公式）。cron 於「實際發送當下」呼叫，確保資料最新。
export async function assembleJournalRaw(sprintIds: string[], readSprint: ReadSprint): Promise<JournalRawData> {
  const allData: JSprintData[] = [];
  const personDateSets = new Map<string, Set<string>>();

  for (const sprintId of sprintIds) {
    try {
      const data = await readSprint(sprintId);
      if (!data) {
        allData.push({ name: sprintId, goal: '', totalDays: 0, completionPct: 0, workloads: [], days: [] });
        continue;
      }
      const sprintName: string = data.name || sprintId;
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const planning: any = data.planning || {};
      const backlog: any = data.backlog || {};
      const daily: any = data.daily || {};
      /* eslint-enable @typescript-eslint/no-explicit-any */

      const devsList: { name: string; role: string }[] =
        Array.isArray(planning.devsList) && planning.devsList.length > 0
          ? planning.devsList.filter((d: { name: string }) => d.name)
          : typeof planning.devs === 'string' && planning.devs
            ? planning.devs.split(',').map((n: string) => ({ name: n.trim(), role: '' })).filter((d: { name: string }) => d.name)
            : [];
      const devNames: string[] = devsList.map(d => d.name);
      const devRoleMap: Record<string, string> = Object.fromEntries(devsList.map(d => [d.name, d.role || '']));
      const completedDays: boolean[] = daily.completedDays || [];
      const q1Map: Record<number, unknown> = daily.dailyNotesQ1 || {};
      const q2Map: Record<number, unknown> = daily.dailyNotesQ2 || {};
      const q3Map: Record<number, unknown> = daily.dailyNotesQ3 || {};
      const totalDays = jDays(planning.timeLimit || planning.duration);
      const base = planning.startDate ? new Date(planning.startDate) : null;

      const days: JDay[] = [];
      for (let i = 0; i < totalDays; i++) {
        const entries: JEntry[] = devNames.map(name => ({
          name, role: devRoleMap[name] || '', q1: jGetNote(q1Map, i, name), q2: jGetNote(q2Map, i, name), q3: jGetNote(q3Map, i, name),
        }));
        const hasRecord = entries.some(e => e.q1 || e.q2 || e.q3);
        if (!hasRecord && !completedDays[i]) continue;
        let dateStr = '', isoDate = '', dowStr = '';
        if (base) {
          const d = new Date(base); d.setDate(d.getDate() + i);
          dateStr = `${d.getMonth() + 1}/${d.getDate()}`; dowStr = WEEKDAYS_J_MOD[d.getDay()];
          isoDate = d.toISOString().slice(0, 10);
        }
        days.push({ idx: i, date: dateStr, isoDate, dow: dowStr, done: !!completedDays[i], entries });
      }

      const sprintDaysNum = Number(backlog.sprintDays) || totalDays || 14;
      const allTasks: { role?: string; time?: string; status?: string; type?: string; pbiId?: string; id?: string }[] = backlog.tasks || [];
      const pbiIds = new Set(allTasks.filter(t => t.status === 'pbi').map(t => t.id));
      const taskItems = allTasks.filter(t => t.type === 'task' && t.pbiId && pbiIds.has(t.pbiId));
      const doneCount = taskItems.filter(t => t.status === 'done').length;
      const completionPct = taskItems.length > 0 ? Math.round(doneCount / taskItems.length * 100) : 0;

      const sprintStart = planning.startDate ? new Date(planning.startDate) : null;
      const workloads: JPersonLoad[] = devsList.map(dev => {
        const myTasks = taskItems.filter(t => t.role?.split(',').map(r => r.trim()).includes(dev.name));
        const assigned = myTasks.reduce((s, t) => s + parseHrs(t.time || ''), 0);
        if (!personDateSets.has(dev.name)) personDateSets.set(dev.name, new Set<string>());
        const daySet = personDateSets.get(dev.name)!;
        if (sprintStart) {
          for (let i = 0; i < sprintDaysNum; i++) {
            const d = new Date(sprintStart); d.setDate(sprintStart.getDate() + i);
            if (d.getDay() !== 0 && d.getDay() !== 6) daySet.add(d.toISOString().slice(0, 10));
          }
        }
        const capacity = sprintDaysNum * 8;
        return { name: dev.name, role: dev.role || '', assigned: Math.round(assigned * 10) / 10, capacity, loadPct: 0 };
      });

      allData.push({ name: sprintName, goal: backlog.sprintGoal || planning.goal || '', totalDays, completionPct, workloads, days });
    } catch {
      allData.push({ name: sprintId, goal: '', totalDays: 0, completionPct: 0, workloads: [], days: [] });
    }
  }

  const totalLoadMap = new Map<string, { role: string; assigned: number }>();
  for (const s of allData) {
    for (const w of s.workloads) {
      const cur = totalLoadMap.get(w.name) || { role: w.role, assigned: 0 };
      cur.assigned += w.assigned;
      if (!cur.role && w.role) cur.role = w.role;
      totalLoadMap.set(w.name, cur);
    }
  }
  const loadLines = Array.from(totalLoadMap.entries()).map(([name, v]) => {
    const daySet = personDateSets.get(name);
    const capacity = daySet && daySet.size > 0 ? daySet.size * 8 : 0;
    const pct = capacity > 0 ? Math.round(v.assigned / capacity * 100) : 0;
    return `  ${name}${v.role ? `(${v.role})` : ''}：${pct}%（${v.assigned}h / ${capacity}h）`;
  });

  return { allData, loadLines, headerMeta: '' };
}
