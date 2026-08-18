// 把任務／子任務的進度紀錄，依站會日切出「自上一個站會日以來」的區間並依人分組。
//
// 純函式，不碰 Firestore、不碰 React——時間視窗的計算是這功能唯一容易出錯的地方，
// 抽出來才看得清楚。
//
// 時區注意：日期一律用本地時間計算。`new Date().toISOString()` 會轉成 UTC，
// 在台灣（UTC+8）會把凌晨的日期算成前一天，這頁既有的 getDayIso 就有這個特性；
// 這裡不沿用，改用本地欄位自行組字串。

import type { Task, ProgressNote } from './taskTypes';

export interface DigestEntry {
  note: ProgressNote;
  taskTitle: string;
  /** 有值代表這則寫在子任務上 */
  subtaskTitle?: string;
}

export interface DigestGroup {
  author: string;
  entries: DigestEntry[];
}

export interface StandupWindow {
  start: number;  // 毫秒
  end: number;
  /** 視窗起點那一天，給 UI 顯示「自 8/15 以來」 */
  startLabel: string;
}

function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** sprintStartDate（YYYY-MM-DD）往後第 dayIndex 天的本地 00:00 */
function dayStart(sprintStartDate: string, dayIndex: number): Date {
  // 不加時區後綴時，'YYYY-MM-DDT00:00:00' 會被當成本地時間解析，正是我們要的
  const d = new Date(`${sprintStartDate}T00:00:00`);
  d.setDate(d.getDate() + dayIndex);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isWorkingDay(d: Date, isHoliday: (iso: string) => boolean): boolean {
  const w = d.getDay();
  if (w === 0 || w === 6) return false;
  return !isHoliday(localIso(d));
}

/**
 * 第 dayIndex 天站會要涵蓋的區間：從「最近一個更早的工作日」的 00:00，
 * 到第 dayIndex 天的 23:59:59。
 *
 * 往回找而不是直接取前一天，是為了讓週一的站會自動涵蓋週五、六、日寫的紀錄。
 * 找不到更早的工作日（例如 Sprint 第一天）就以第 0 天為起點。
 */
export function standupWindow(
  sprintStartDate: string,
  dayIndex: number,
  isHoliday: (iso: string) => boolean
): StandupWindow | null {
  if (!sprintStartDate) return null;

  const today = dayStart(sprintStartDate, dayIndex);
  if (Number.isNaN(today.getTime())) return null;

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 1);
  const end = endDate.getTime() - 1;

  let start = dayStart(sprintStartDate, 0);
  // 上限 14 天：連假再長也不該無限往回找，找不到就退回 Sprint 第一天
  for (let k = 1; k <= 14; k++) {
    const idx = dayIndex - k;
    if (idx < 0) break;
    const cand = dayStart(sprintStartDate, idx);
    if (isWorkingDay(cand, isHoliday)) { start = cand; break; }
  }

  return {
    start: start.getTime(),
    end,
    startLabel: `${start.getMonth() + 1}/${start.getDate()}`,
  };
}

/** 挑出區間內的進度紀錄，依作者分組。組內由舊到新——「先做了 A、然後卡在 B」讀起來才順。 */
export function collectDigest(tasks: Task[], win: StandupWindow): DigestGroup[] {
  const byAuthor = new Map<string, DigestEntry[]>();

  const push = (note: ProgressNote, taskTitle: string, subtaskTitle?: string) => {
    if (note.ts < win.start || note.ts > win.end) return;
    const author = (note.authorName || note.authorEmail || '未具名').trim() || '未具名';
    const arr = byAuthor.get(author) || [];
    arr.push({ note, taskTitle: taskTitle || '(未命名)', subtaskTitle });
    byAuthor.set(author, arr);
  };

  for (const t of tasks || []) {
    for (const n of t.notes || []) push(n, t.title);
    for (const s of t.subtasks || []) {
      for (const n of s.notes || []) push(n, t.title, s.title || s.assignee);
    }
  }

  return Array.from(byAuthor.entries())
    .map(([author, entries]) => ({
      author,
      entries: entries.sort((a, b) => a.note.ts - b.note.ts),
    }))
    .sort((a, b) => a.author.localeCompare(b.author, 'zh-Hant'));
}
