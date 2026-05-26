// 雙向同步用：在 scrum-project (planning) 與 scrum-project-new (sprintPlanning)
// 兩種 schema 之間互相轉換。共用此檔。

export interface RightDev { id: string; name: string; role: string }
export interface RightItem { id: string; text: string }
export interface RightPlanning {
  poIdea: string;
  timeLimit: string;
  startDate: string;
  stakeholders: string;
  po: string;
  sm: string;
  devs: string;
  devsList: RightDev[];
  whys: RightItem[];
  whats: RightItem[];
  hows: RightItem[];
}

export interface LeftTeamMember { name: string; role: string; capacity: number }
export interface LeftStakeholder { name: string; role: string }
export interface LeftDodItem { text: string; done: boolean }
export interface LeftRisk { level: 'high'|'medium'|'low'; title: string; impact: string; owner: string }
export interface LeftSprintPlanning {
  sprintId: string;
  goal: string;
  timebox: '2-week' | '1-week' | 'custom';
  customDays: number;
  startDate: string;
  endDateOverride: string;
  meetingMode: 'offline' | 'online';
  meetingPlace: string;
  meetingLink: string;
  po: string;
  sm: string;
  team: LeftTeamMember[];
  stakeholders: LeftStakeholder[];
  initialIdea: string;
  matrix: { why: string; what: string; who: string; when: string; where: string; how: string };
  dod: LeftDodItem[];
  risks: LeftRisk[];
}

const lines = (s?: string) => (s || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
const join = (items?: { text: string }[]) => (items || []).map(i => (i.text || '').trim()).filter(Boolean).join('\n');
const itemsFromText = (text: string): RightItem[] => {
  const arr = lines(text).map((t, i) => ({ id: `${i + 1}`, text: t }));
  return arr.length > 0 ? arr : [{ id: '1', text: '' }];
};

const parseStakeholderLine = (line: string): LeftStakeholder => {
  // "陳副總（主要贊助人）" or "陳副總(主要贊助人)" → {name:'陳副總', role:'主要贊助人'}
  const m = line.match(/^(.+?)[（(]\s*(.+?)\s*[）)]\s*$/);
  if (m) return { name: m[1].trim(), role: m[2].trim() };
  return { name: line, role: '' };
};

const formatStakeholder = (s: LeftStakeholder): string => {
  const name = (s.name || '').trim();
  const role = (s.role || '').trim();
  if (!name) return '';
  return role ? `${name}（${role}）` : name;
};

const timeLimitToTimebox = (tl: string): { timebox: LeftSprintPlanning['timebox']; customDays: number } => {
  if (tl === '1') return { timebox: '1-week', customDays: 7 };
  if (tl === '2') return { timebox: '2-week', customDays: 14 };
  if (tl === '30d') return { timebox: 'custom', customDays: 30 };
  const n = Number(tl);
  if (Number.isFinite(n) && n > 0) return { timebox: 'custom', customDays: n * 7 };
  return { timebox: '2-week', customDays: 14 };
};

const timeboxToTimeLimit = (tb: LeftSprintPlanning['timebox'], customDays: number): string => {
  if (tb === '1-week') return '1';
  if (tb === '2-week') return '2';
  // custom
  if (customDays === 30) return '30d';
  if (customDays === 7) return '1';
  if (customDays === 14) return '2';
  if (customDays === 21) return '3';
  if (customDays === 28) return '4';
  if (customDays === 30) return '30d';
  // 落到最接近的「週」對應
  const weeks = Math.max(1, Math.round(customDays / 7));
  if (weeks <= 4) return String(weeks);
  return '30d';
};

export const EMPTY_LEFT: LeftSprintPlanning = {
  sprintId: '',
  goal: '',
  timebox: '2-week',
  customDays: 14,
  startDate: '',
  endDateOverride: '',
  meetingMode: 'offline',
  meetingPlace: '',
  meetingLink: '',
  po: '',
  sm: '',
  team: [],
  stakeholders: [],
  initialIdea: '',
  matrix: { why: '', what: '', who: '', when: '', where: '', how: '' },
  dod: [],
  risks: [],
};

// 右 → 左：保留左邊獨有欄位（meetingMode、dod、risks、matrix.who/when/where 等）
export function planningToSprintPlanning(
  p: Partial<RightPlanning>,
  existing?: Partial<LeftSprintPlanning>
): LeftSprintPlanning {
  const base: LeftSprintPlanning = { ...EMPTY_LEFT, ...(existing || {}) };
  const tb = timeLimitToTimebox(p.timeLimit || '2');

  // devsList 為主；若沒有，從 devs 字串拆
  let team: LeftTeamMember[];
  if (p.devsList && p.devsList.length > 0) {
    team = p.devsList
      .filter(d => (d.name || '').trim())
      .map(d => {
        const existingMember = base.team.find(m => m.name === d.name);
        return {
          name: d.name,
          role: d.role || existingMember?.role || '',
          capacity: existingMember?.capacity ?? 8,
        };
      });
  } else if (p.devs) {
    team = lines(p.devs).map(name => {
      const existingMember = base.team.find(m => m.name === name);
      return { name, role: existingMember?.role || '', capacity: existingMember?.capacity ?? 8 };
    });
  } else {
    team = base.team;
  }

  const stakeholdersArr: LeftStakeholder[] = lines(p.stakeholders).map(parseStakeholderLine);

  return {
    ...base,
    timebox: tb.timebox,
    customDays: tb.customDays,
    startDate: p.startDate ?? base.startDate,
    po: p.po ?? base.po,
    sm: p.sm ?? base.sm,
    team,
    stakeholders: stakeholdersArr.length > 0 || (p.stakeholders ?? '').trim() === ''
      ? stakeholdersArr
      : base.stakeholders,
    initialIdea: p.poIdea ?? base.initialIdea,
    matrix: {
      ...base.matrix,
      why: join(p.whys),
      what: join(p.whats),
      how: join(p.hows),
    },
  };
}

// 左 → 右
export function sprintPlanningToPlanning(
  sp: Partial<LeftSprintPlanning>,
  existing?: Partial<RightPlanning>
): RightPlanning {
  const base: RightPlanning = {
    poIdea: '',
    timeLimit: '2',
    startDate: '',
    stakeholders: '',
    po: '',
    sm: '',
    devs: '',
    devsList: [],
    whys: [{ id: '1', text: '' }],
    whats: [{ id: '1', text: '' }],
    hows: [{ id: '1', text: '' }],
    ...(existing || {}),
  };

  const team = sp.team || [];
  const devsList: RightDev[] = team
    .filter(m => (m.name || '').trim())
    .map((m, i) => ({
      id: base.devsList[i]?.id || `${Date.now()}-${i}`,
      name: m.name,
      role: m.role || '',
    }));
  const devsString = devsList.map(d => d.name).join(',');

  const stakeholdersString = (sp.stakeholders || []).map(formatStakeholder).filter(Boolean).join('\n');

  return {
    poIdea: sp.initialIdea ?? base.poIdea,
    timeLimit: timeboxToTimeLimit(sp.timebox ?? 'custom', sp.customDays ?? 14),
    startDate: sp.startDate ?? base.startDate,
    stakeholders: stakeholdersString,
    po: sp.po ?? base.po,
    sm: sp.sm ?? base.sm,
    devs: devsString,
    devsList: devsList.length > 0 ? devsList : base.devsList,
    whys: itemsFromText(sp.matrix?.why ?? ''),
    whats: itemsFromText(sp.matrix?.what ?? ''),
    hows: itemsFromText(sp.matrix?.how ?? ''),
  };
}

export const isShallowEqualJSON = (a: unknown, b: unknown): boolean => {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
};
