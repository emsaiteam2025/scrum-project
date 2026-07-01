"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, where } from 'firebase/firestore';

interface Sprint {
  id: string;
  name: string;
  createdAt: number;
  ownerId?: string;
  collaborators?: { email: string; role: 'editor' | 'viewer' }[];
  collaboratorEmails?: string[];
  sprintStatus?: 'pending' | 'in-progress' | 'completed';
}

interface TeamMember { id: string; name: string; role: string }
interface Holiday { id: string; date: string; name: string }

interface SprintDashboard {
  sprintGoal: string;
  totalTasks: number;
  todo: number;
  doing: number;
  done: number;
  pbiTotal: number;
  pbiAccepted: number;
  startDate: string;
  endDate: string;
}

// ── 工作日誌型別（module 層，方便 pure function 使用）──
interface JEntry { name: string; role: string; q1: string; q2: string; q3: string }
interface JDay { idx: number; date: string; isoDate: string; dow: string; done: boolean; entries: JEntry[] }
interface JPersonLoad { name: string; role: string; assigned: number; capacity: number; loadPct: number }
interface JSprintData { name: string; goal: string; totalDays: number; completionPct: number; workloads: JPersonLoad[]; days: JDay[] }
interface JournalRawData { allData: JSprintData[]; loadLines: string[]; headerMeta: string }

const WEEKDAYS_J_MOD = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

const DIVIDER_HEAVY = '══════════════════════════════';
const DIVIDER_LIGHT = '──────────────────────────────';

function buildDailyText(raw: JournalRawData, isoDate: string): string {
  const DOW = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
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

function buildWeeklyText(raw: JournalRawData, rangeFrom: string, rangeTo: string): string {
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
        : `Day ${w*7+1} — Day ${Math.min((w+1)*7, maxIdx+1)}`;

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
            const label = d.date ? `${d.date} (${d.dow})` : `Day ${d.idx+1}/${s.totalDays}`;
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
            const label = d.date ? `${d.date} (${d.dow})` : `Day ${d.idx+1}/${s.totalDays}`;
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

export default function SprintList() {
  const { user, loading: authLoading, signInWithGoogle, logout } = useAuth();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const [shareModalSprint, setShareModalSprint] = useState<Sprint | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'editor'|'viewer'>('editor');
  const [dashboards, setDashboards] = useState<Record<string, SprintDashboard>>({});
  const [dashLoading, setDashLoading] = useState(false);

  // 組織成員庫
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showTeamSection, setShowTeamSection] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  // 國定假日庫
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  // 組織設定分頁：'members' | 'holidays' | 'line'
  const [orgSettingsTab, setOrgSettingsTab] = useState<'members' | 'holidays' | 'line'>('members');
  // LINE 推播
  const [lineUsers, setLineUsers] = useState<{ lineUserId: string; displayName: string; blocked?: boolean }[]>([]);
  const [lineRecipients, setLineRecipients] = useState<string[]>([]); // 已選取的 lineUserId
  const [lineSchedule, setLineSchedule] = useState({ dailyEnabled: false, dailyHour: 18, weeklyEnabled: false, weeklyDay: 5, weeklyHour: 17 });
  const [lineSending, setLineSending] = useState(false);
  const [lineSent, setLineSent] = useState(false);
  const [lineUsersLoading, setLineUsersLoading] = useState(false);
  const [lineTestSending, setLineTestSending] = useState(false);
  const [lineTestResult, setLineTestResult] = useState<'idle' | 'ok' | 'error'>('idle');
  // 工作日誌多選匯出
  const [selectedSprintIds, setSelectedSprintIds] = useState<Set<string>>(new Set());
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [journalDailyText, setJournalDailyText] = useState('');
  const [journalWeeklyText, setJournalWeeklyText] = useState('');
  const [journalType, setJournalType] = useState<'daily' | 'weekly'>('daily');
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalCopied, setJournalCopied] = useState(false);
  const [journalDate, setJournalDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const [journalRangeFrom, setJournalRangeFrom] = useState('');
  const [journalRangeTo, setJournalRangeTo] = useState('');
  const journalRawRef = useRef<JournalRawData | null>(null);

  const syncTeamToLocalStorage = (members: TeamMember[]) => {
    localStorage.setItem('orgTeamMembers', JSON.stringify(members));
  };

  const saveTeamMembers = async (members: TeamMember[]) => {
    setTeamMembers(members);
    syncTeamToLocalStorage(members);
    if (user) {
      const ref = doc(db, 'users', user.uid);
      await setDoc(ref, { teamMembers: members }, { merge: true });
    }
  };

  const addMember = async () => {
    const name = newMemberName.trim();
    if (!name) return;
    const next = [...teamMembers, { id: Date.now().toString(), name, role: '' }];
    await saveTeamMembers(next);
    setNewMemberName('');
  };

  const removeMember = async (id: string) => {
    await saveTeamMembers(teamMembers.filter(m => m.id !== id));
  };

  const updateMemberField = async (id: string, field: 'name' | 'role', value: string) => {
    await saveTeamMembers(teamMembers.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const saveHolidays = async (list: Holiday[]) => {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    setHolidays(sorted);
    localStorage.setItem('orgHolidays', JSON.stringify(sorted));
    if (user) {
      const ref = doc(db, 'users', user.uid);
      await setDoc(ref, { holidays: sorted }, { merge: true });
    }
  };

  const addHoliday = async () => {
    const date = newHolidayDate.trim();
    const name = newHolidayName.trim();
    if (!date || !name) return;
    await saveHolidays([...holidays, { id: Date.now().toString(), date, name }]);
    setNewHolidayDate('');
    setNewHolidayName('');
  };

  const removeHoliday = async (id: string) => {
    await saveHolidays(holidays.filter(h => h.id !== id));
  };

  // ── LINE 推播 ──
  const loadLineUsers = async () => {
    if (!user) return;
    setLineUsersLoading(true);
    try {
      const { collection: col, getDocs: gd } = await import('firebase/firestore');
      const snap = await gd(col(db, 'lineUsers'));
      const list = snap.docs
        .map(d => d.data() as { lineUserId: string; displayName: string; blocked?: boolean })
        .filter(u => !u.blocked)
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-TW'));
      setLineUsers(list);
    } catch {}
    setLineUsersLoading(false);
  };

  const saveLineSettings = async (recipients: string[], schedule: typeof lineSchedule) => {
    if (!user) return;
    const payload = { recipients, schedule };
    localStorage.setItem('lineSettings', JSON.stringify(payload));
    // 同步到 Firebase（lineSchedule collection）
    try {
      const { doc: fd, setDoc: sd } = await import('firebase/firestore');
      await sd(fd(db, 'lineSchedule', user.uid), {
        ...schedule,
        recipients,
        lastDailyText: journalDailyText || '',
        lastWeeklyText: journalWeeklyText || '',
        updatedAt: Date.now(),
      }, { merge: true });
    } catch {}
  };

  const toggleLineRecipient = (lineUserId: string) => {
    const next = lineRecipients.includes(lineUserId)
      ? lineRecipients.filter(id => id !== lineUserId)
      : [...lineRecipients, lineUserId];
    setLineRecipients(next);
    saveLineSettings(next, lineSchedule);
  };

  const updateLineSchedule = (patch: Partial<typeof lineSchedule>) => {
    const next = { ...lineSchedule, ...patch };
    setLineSchedule(next);
    saveLineSettings(lineRecipients, next);
  };

  const sendLineJournal = async () => {
    if (!lineRecipients.length) { alert('請先選取至少一位 LINE 收件人'); return; }
    const text = journalType === 'daily' ? journalDailyText : journalWeeklyText;
    if (!text.trim()) { alert('日誌內容為空'); return; }
    setLineSending(true);
    try {
      const res = await fetch('/api/send-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: lineRecipients, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '發送失敗');
      setLineSent(true);
      setTimeout(() => setLineSent(false), 3000);
    } catch (e: unknown) {
      alert(`發送失敗：${e instanceof Error ? e.message : e}`);
    }
    setLineSending(false);
  };

  const sendLineTest = async () => {
    if (!lineRecipients.length) { alert('請先勾選至少一位收件人'); return; }
    setLineTestSending(true);
    setLineTestResult('idle');
    try {
      const res = await fetch('/api/send-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: lineRecipients, text: '🔔 這是來自 Scrum 系統的測試訊息，LINE 推播功能已成功連線！' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '發送失敗');
      setLineTestResult('ok');
    } catch (e: unknown) {
      setLineTestResult('error');
      alert(`測試發送失敗：${e instanceof Error ? e.message : e}`);
    }
    setLineTestSending(false);
    setTimeout(() => setLineTestResult('idle'), 5000);
  };

  useEffect(() => {
    // 從 localStorage 還原 LINE 設定
    try {
      const raw = localStorage.getItem('lineSettings');
      if (raw) {
        const { recipients, schedule } = JSON.parse(raw);
        if (recipients) setLineRecipients(recipients);
        if (schedule) setLineSchedule(schedule);
      }
    } catch {}
  }, []);

  // 當日誌文字更新時，同步到 Firebase 供定時發送使用
  useEffect(() => {
    if (!user || (!journalDailyText && !journalWeeklyText)) return;
    import('firebase/firestore').then(({ doc: fd, setDoc: sd }) => {
      sd(fd(db, 'lineSchedule', user.uid), {
        lastDailyText: journalDailyText,
        lastWeeklyText: journalWeeklyText,
        updatedAt: Date.now(),
      }, { merge: true }).catch(() => {});
    });
  }, [journalDailyText, journalWeeklyText, user]);

  useEffect(() => {
    // 如果載入超過 5 秒，顯示逾時提示
    const timer = setTimeout(() => {
      setLoadTimeout(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // 強制逾時保底：Firebase auth 若 7 秒仍未回應，以 localStorage 資料強制解鎖
  const loadingRef = React.useRef(true);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loadingRef.current) return;
      try {
        const saved = localStorage.getItem('sprints');
        if (saved) {
          const parsed = JSON.parse(saved).filter((s: Sprint) => s && s.id && s.id !== 'default' && s.createdAt);
          setSprints(parsed);
        }
      } catch {}
      setLoading(false);
    }, 7000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 檢查是否有網址參數，若有且載入完成，直接導向
    const checkLink = async () => {
      if (!loading && !authLoading) {
        const params = new URLSearchParams(window.location.search);
        const targetSprintId = params.get('sprint');

        if (targetSprintId) {
          console.log('[ShareLink] 嘗試開啟專案連結:', targetSprintId, '| 使用者:', user ? user.email : '訪客');
          let targetSprint = sprints.find(s => s.id === targetSprintId);
          if (targetSprint) {
            console.log('[ShareLink] 在本地清單找到專案');
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let fetchError: any = null;
          let docExists = true;
          if (!targetSprint) {
            // 從 Firebase 單獨抓取該專案 (給擁有連結的人檢視)
            try {
              const docRef = doc(db, 'sprints', targetSprintId);
              const snap = await getDoc(docRef);
              docExists = snap.exists();
              console.log('[ShareLink] Firestore 查詢結果 exists =', docExists);
              if (docExists) {
                const data = snap.data() as Sprint;
                // 雲端文件可能未保存 id 欄位，這裡補上 docId 確保後續流程正常
                targetSprint = { ...data, id: data.id || snap.id };
              }
            } catch (err) {
              fetchError = err;
              console.error('[ShareLink] Firestore 讀取失敗:', err);
            }
          }

          if (targetSprint) {
            // 若不在用戶清單中（非擁有者/協作者），先設唯讀旗標；selectSprint 會處理角色判斷
            const isInUserList = !!sprints.find(s => s.id === targetSprintId);
            if (!isInUserList) {
              localStorage.setItem('sprintRole_' + targetSprintId, 'viewer_via_link');
            }
            selectSprint(targetSprint.id, targetSprint.name);
          } else {
            // 區分錯誤類型，給出有意義的提示
            const code = fetchError?.code || '';
            if (code === 'permission-denied' || /permission/i.test(fetchError?.message || '')) {
              if (user) {
                alert('您沒有權限檢視此專案。請聯絡專案擁有者將您加入協作者。');
              } else {
                alert('此專案需要登入才能檢視。請先以 Google 帳號登入後再開啟連結。');
              }
            } else if (fetchError) {
              alert(`讀取專案時發生錯誤：${fetchError?.message || fetchError}\n請檢查網路或 Firebase 設定。`);
            } else if (!docExists) {
              alert('找不到此專案！可能已被刪除，或連結不正確。');
            } else {
              alert('無法開啟此專案，請稍後再試。');
            }
            window.history.replaceState({}, '', '/');
          }
        }
      }
    };
    checkLink();
  }, [sprints, loading, authLoading, user]);

  useEffect(() => {
    if (authLoading) return; // 等待 Firebase 確認登入狀態

    const fetchSprints = async () => {
      setLoading(true);
      if (user) {
        try {
          const sprintsRef = collection(db, 'sprints');
          const qOwned = query(sprintsRef, where('ownerId', '==', user.uid));
          const snapOwned = await getDocs(qOwned);

          // 自動修復：確保每個自己擁有的 Sprint 的 collaboratorEmails 都是小寫且與 collaborators 同步
          // 讓其他使用者的查詢能正確找到（Firestore array-contains 大小寫敏感）
          await Promise.all(snapOwned.docs.map(async (d) => {
            const data = d.data();
            const collabs: { email: string; role: string }[] = data.collaborators || [];
            if (collabs.length === 0) return;
            const normalizedEmails = collabs.map(c => c.email.toLowerCase());
            const storedEmails: string[] = data.collaboratorEmails || [];
            console.log('[RepairEmails] Sprint:', d.id, '| collaborators:', collabs.map(c => c.email), '| collaboratorEmails:', storedEmails);
            const needsUpdate =
              normalizedEmails.length !== storedEmails.length ||
              normalizedEmails.some((e, i) => e !== storedEmails[i]);
            if (needsUpdate) {
              console.log('[RepairEmails] ⬆️ 修復 collaboratorEmails:', normalizedEmails);
              try {
                await setDoc(doc(db, 'sprints', d.id), {
                  collaborators: collabs.map(c => ({ ...c, email: c.email.toLowerCase() })),
                  collaboratorEmails: normalizedEmails,
                }, { merge: true });
                console.log('[RepairEmails] ✅ 修復成功');
              } catch (err) {
                console.error('[RepairEmails] ❌ 修復失敗:', err);
              }
            } else {
              console.log('[RepairEmails] ✓ 不需修復');
            }
          }));

          let sharedDocs: Sprint[] = [];
          if (user.email) {
            // 正規化 email 為小寫，避免大小寫不一致導致查不到
            const userEmailLower = user.email.toLowerCase();
            console.log('[SharedSprints] 查詢協作者 email:', userEmailLower);
            const qShared = query(sprintsRef, where('collaboratorEmails', 'array-contains', userEmailLower));
            const snapShared = await getDocs(qShared);
            sharedDocs = snapShared.docs.map(doc => doc.data() as Sprint);
            console.log('[SharedSprints] 查詢結果筆數:', snapShared.docs.length);
            snapShared.docs.forEach(d => {
              const data = d.data();
              console.log('[SharedSprints] 找到 sprint:', d.id, '| name:', data.name, '| collaboratorEmails:', data.collaboratorEmails);
            });
            if (snapShared.docs.length === 0) {
              console.log('[SharedSprints] ⚠️ 查無共用 Sprint。可能原因：1) collaboratorEmails 欄位不存在或 email 大小寫不符，2) 擁有者尚未開啟大廳觸發修復。請確認擁有者已登入大廳後再試。');
            }
          }

          // 合併去重複
          const allDocs = [...snapOwned.docs.map(d => d.data() as Sprint), ...sharedDocs];
          const uniqueDocsMap = new Map();
          allDocs.forEach(d => uniqueDocsMap.set(d.id, d));

          let loaded = Array.from(uniqueDocsMap.values());
          if (loaded.length > 0) {

            // 過濾並刪除壞掉的雲端資料
            const badDocs = loaded.filter(s => !s || !s.id || s.id === 'default' || !s.createdAt);
            for (const bad of badDocs) {
               try {
                 await deleteDoc(doc(db, 'sprints', bad.id || 'default'));
               } catch(err) { console.error(err) }
            }

            loaded = loaded.filter(s => s && s.id && s.id !== 'default' && s.createdAt).sort((a, b) => b.createdAt - a.createdAt);
            setSprints(loaded);
          } else {
            // 此用戶既無自己的 Sprint，也無被共用的 Sprint
            // 只有確認是全新用戶（無 sharedDocs 也無 ownedDocs）才建立預設 Sprint
            // 避免協作者因 email 不符合查詢而被錯誤建立新 Sprint
            const hasOwnedDocs = snapOwned.docs.length > 0;
            const hasSharedDocs = sharedDocs.length > 0;
            if (!hasOwnedDocs && !hasSharedDocs) {
              const initial = [{ id: `sprint-${Date.now()}`, name: '我的第一個 Sprint', createdAt: Date.now() }];
              setSprints(initial);
              await setDoc(doc(db, 'sprints', initial[0].id), { ...initial[0], ownerId: user.uid, collaborators: [] });
            } else {
              setSprints([]);
            }
          }
        } catch (error) {
          console.error("載入專案失敗:", error);
          alert("讀取雲端資料庫失敗，請確認 Firebase 設定。");
        }
      } else {
        // 未登入，讀取 localStorage
        try {
          const saved = localStorage.getItem('sprints');
          if (saved) {
            // 過濾掉沒有 ID 的幽靈資料或缺乏建立時間的壞資料
            const parsedSprints = JSON.parse(saved).filter((s: Sprint) => s && s.id && s.id !== 'default' && s.createdAt);
            setSprints(parsedSprints);
            // 同步寫回乾淨的資料
            localStorage.setItem('sprints', JSON.stringify(parsedSprints));
          } else {
            setSprints([]);
          }
        } catch (e) {
          console.error("解析 localStorage 失敗:", e);
          setSprints([]);
        }
      }
      setLoading(false);
    };

    fetchSprints();
  }, [user, authLoading]);

  // 載入各 Sprint 的 backlog 進度資料
  useEffect(() => {
    if (loading || sprints.length === 0) return;
    const fetchDashboard = async () => {
      setDashLoading(true);
      const result: Record<string, SprintDashboard> = {};
      await Promise.all(sprints.map(async (sprint) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let backlog: any = null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let planning: any = null;
          if (user) {
            const snap = await getDoc(doc(db, 'sprints', sprint.id));
            if (snap.exists()) {
              backlog = snap.data().backlog ?? null;
              planning = snap.data().planning ?? null;
            }
          } else {
            const localBacklog = localStorage.getItem(`sprint_${sprint.id}_backlog`);
            const localPlanning = localStorage.getItem(`sprint_${sprint.id}_planning`);
            if (localBacklog) backlog = JSON.parse(localBacklog);
            if (localPlanning) planning = JSON.parse(localPlanning);
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tasks: any[] = backlog?.tasks ?? [];
          const pbis = tasks.filter(t => t.status === 'pbi');
          const pbiIdSet = new Set(pbis.map((t: { id: string }) => t.id));
          // 只計算屬於現有 PBI 的任務，排除孤兒任務
          const allTasks = tasks.filter(t => t.type === 'task' && t.pbiId && pbiIdSet.has(t.pbiId));
          const startDate: string = planning?.startDate ?? '';
          const sprintDays: number = Number(backlog?.sprintDays ?? 0);
          let endDate = '';
          if (startDate && sprintDays > 0) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + sprintDays - 1);
            endDate = d.toISOString().split('T')[0];
          }
          result[sprint.id] = {
            sprintGoal: backlog?.sprintGoal ?? '',
            totalTasks: allTasks.length,
            todo: allTasks.filter(t => t.status === 'todo').length,
            doing: allTasks.filter(t => t.status === 'doing').length,
            done: allTasks.filter(t => t.status === 'done').length,
            pbiTotal: pbis.length,
            pbiAccepted: pbis.filter(t => t.acceptedBy).length,
            startDate,
            endDate,
          };
        } catch {
          result[sprint.id] = { sprintGoal: '', totalTasks: 0, todo: 0, doing: 0, done: 0, pbiTotal: 0, pbiAccepted: 0, startDate: '', endDate: '' };
        }
      }));
      setDashboards(result);
      setDashLoading(false);
    };
    fetchDashboard();
  }, [sprints, loading, user]);

  // 判斷某 Sprint 是否「進行中」
  // 優先順序：① 明確的 sprintStatus → ② 有 doing 任務 → ③ 日期範圍內 → ④ 有任務但未全完成
  const isSprintInProgress = (s: Sprint): boolean => {
    if (s.sprintStatus === 'in-progress') return true;
    if (s.sprintStatus === 'completed' || s.sprintStatus === 'pending') return false;
    const d = dashboards[s.id];
    const total = d?.totalTasks ?? 0;
    if (total === 0) return false;
    const td = d?.todo ?? 0;
    const dg = d?.doing ?? 0;
    if (td === 0 && dg === 0) return false; // 全部已完成
    if (dg > 0) return true;               // 有任務進行中，確定是進行中
    // 全為 todo：用日期範圍輔助判斷
    const today = new Date().toISOString().slice(0, 10);
    if (d?.startDate && d?.endDate) return today >= d.startDate && today <= d.endDate;
    return true; // 有未完成任務但無日期，視為進行中
  };

  // 預設勾選「進行中」Sprint（等 sprints 與 dashboards 都載完才執行）
  useEffect(() => {
    if (dashLoading) return;
    if (sprints.length === 0) return;
    if (Object.keys(dashboards).length < sprints.length) return; // dashboard 資料尚未全部就緒
    setSelectedSprintIds(prev => {
      if (prev.size > 0) return prev;
      return new Set(sprints.filter(isSprintInProgress).map(s => s.id));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashLoading, sprints, dashboards]);

  // 日期變更時重新產生日誌文字
  useEffect(() => {
    if (!journalRawRef.current || journalLoading) return;
    if (journalType === 'daily') {
      setJournalDailyText(buildDailyText(journalRawRef.current, journalDate));
    } else {
      setJournalWeeklyText(buildWeeklyText(journalRawRef.current, journalRangeFrom, journalRangeTo));
    }
  }, [journalDate, journalRangeFrom, journalRangeTo, journalType, journalLoading]);

  // 載入成員庫 & 假日庫
  useEffect(() => {
    const local = localStorage.getItem('orgTeamMembers');
    if (local) { try { setTeamMembers(JSON.parse(local)); } catch {} }
    const localH = localStorage.getItem('orgHolidays');
    if (localH) { try { setHolidays(JSON.parse(localH)); } catch {} }
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          if (d.teamMembers) {
            const members: TeamMember[] = d.teamMembers;
            setTeamMembers(members);
            syncTeamToLocalStorage(members);
          }
          if (d.holidays) {
            const list: Holiday[] = d.holidays;
            setHolidays(list);
            localStorage.setItem('orgHolidays', JSON.stringify(list));
          }
        }
      } catch {}
    })();
  }, [user]);

  const createSprint = async () => {
    const newSprint: Sprint = {
      id: `sprint-${Date.now()}`,
      name: '未命名的新 Sprint',
      createdAt: Date.now(),
      ownerId: user ? user.uid : undefined,
      collaborators: []
    };
    const updated = [newSprint, ...sprints];
    setSprints(updated);
    setEditingId(newSprint.id);

    if (user) {
      const sprintRef = doc(db, 'sprints', newSprint.id);
      await setDoc(sprintRef, newSprint);
    } else {
      localStorage.setItem('sprints', JSON.stringify(updated));
    }
  };

  
  const copySprint = async (sourceId: string) => {
    const newId = `sprint-${Date.now()}`;
    if (user) {
      const sourceSnap = await getDoc(doc(db, 'sprints', sourceId));
      if (!sourceSnap.exists()) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const src: any = sourceSnap.data();
      const copyData = {
        ...src,
        id: newId,
        name: `${src.name || '未命名 Sprint'} (複製)`,
        createdAt: Date.now(),
        sprintStatus: 'pending',
        ownerId: user.uid,
        collaborators: [],
        collaboratorEmails: [],
        editHistory: [],
      };
      await setDoc(doc(db, 'sprints', newId), copyData);
      const newSprint: Sprint = { id: newId, name: copyData.name, createdAt: copyData.createdAt, ownerId: user.uid, collaborators: [], sprintStatus: 'pending' };
      setSprints(prev => [newSprint, ...prev]);
      setEditingId(newId);
    } else {
      const source = sprints.find(s => s.id === sourceId);
      if (!source) return;
      ['planning', 'backlog', 'review', 'retrospective', 'daily-scrum'].forEach(page => {
        const data = localStorage.getItem(`sprint_${sourceId}_${page}`);
        if (data) localStorage.setItem(`sprint_${newId}_${page}`, data);
      });
      const copyData: Sprint = { id: newId, name: `${source.name} (複製)`, createdAt: Date.now(), sprintStatus: 'pending', collaborators: [] };
      const updated = [copyData, ...sprints];
      setSprints(updated);
      localStorage.setItem('sprints', JSON.stringify(updated));
      setEditingId(newId);
    }
  };

  const updateSprintStatus = async (sprintId: string, newStatus: Sprint['sprintStatus']) => {
    setSprints(prev => prev.map(s => s.id === sprintId ? { ...s, sprintStatus: newStatus } : s));
    if (user) {
      await setDoc(doc(db, 'sprints', sprintId), { sprintStatus: newStatus }, { merge: true });
    } else {
      const updated = sprints.map(s => s.id === sprintId ? { ...s, sprintStatus: newStatus } : s);
      localStorage.setItem('sprints', JSON.stringify(updated));
    }
  };

  const handleAddCollaborator = async () => {
    if (!shareModalSprint || !shareEmail || !user) return;

    const normalizedEmail = shareEmail.trim().toLowerCase();
    let currentCollabs = shareModalSprint.collaborators || [];
    if (currentCollabs.find(c => c.email.toLowerCase() === normalizedEmail)) {
      alert('此 Email 已在協作者清單中。');
      return;
    }

    currentCollabs = [...currentCollabs, { email: normalizedEmail, role: shareRole }];
    const emails = currentCollabs.map(c => c.email.toLowerCase());

    const updatedData = { collaborators: currentCollabs, collaboratorEmails: emails };

    try {
      await setDoc(doc(db, 'sprints', shareModalSprint.id), updatedData, { merge: true });
      setShareModalSprint({ ...shareModalSprint, ...updatedData });
      setSprints(prev => prev.map(s => s.id === shareModalSprint.id ? { ...s, ...updatedData } : s));
      setShareEmail('');
      alert(`✅ 已成功邀請 ${normalizedEmail} 成為協作者！`);
    } catch(err) {
      console.error(err);
      alert('邀請失敗，請稍後再試。');
    }
  };
  
  const handleRemoveCollaborator = async (email: string) => {
    if (!shareModalSprint) return;

    const normalizedEmail = email.toLowerCase();
    let currentCollabs = shareModalSprint.collaborators || [];
    currentCollabs = currentCollabs.filter(c => c.email.toLowerCase() !== normalizedEmail);
    const emails = currentCollabs.map(c => c.email.toLowerCase());
    
    const updatedData = { collaborators: currentCollabs, collaboratorEmails: emails };
    
    try {
      await setDoc(doc(db, 'sprints', shareModalSprint.id), updatedData, { merge: true });
      setShareModalSprint({ ...shareModalSprint, ...updatedData });
      setSprints(prev => prev.map(s => s.id === shareModalSprint.id ? { ...s, ...updatedData } : s));
    } catch(err) {
      console.error(err);
    }
  };

  const deleteSprint = async (id: string) => {
    if (!id) {
      alert('無法刪除此專案，因為專案 ID 無效（可能為舊的壞資料）。');
      // 仍然將其從畫面移除
      const updated = sprints.filter(s => s.id !== id);
      setSprints(updated);
      if (!user) localStorage.setItem('sprints', JSON.stringify(updated));
      return;
    }

    if (confirm('確定要刪除這個 Sprint 嗎？相關資料將會遺失。')) {
      const updated = sprints.filter(s => s.id !== id);
      setSprints(updated);
      
      if (user) {
        try {
          await deleteDoc(doc(db, 'sprints', id));
        } catch (err) {
          console.error("刪除雲端資料失敗:", err);
        }
      } else {
        localStorage.setItem('sprints', JSON.stringify(updated));
      }

      if (localStorage.getItem('currentSprintId') === id) {
        localStorage.removeItem('currentSprintId');
        localStorage.removeItem('currentSprintName');
      }
    }
  };

  const updateSprintName = async (id: string, newName: string) => {
    if (!id) return;
    const sprintToUpdate = sprints.find(s => s.id === id);
    if (!sprintToUpdate) return;
    const updatedData = { ...sprintToUpdate, name: newName };

    const updated = sprints.map(s => s.id === id ? updatedData : s);
    setSprints(updated);

    if (user) {
      try {
        await setDoc(doc(db, 'sprints', id), updatedData, { merge: true });
      } catch (err) {
        console.error("更新雲端名稱失敗:", err);
      }
    } else {
      localStorage.setItem('sprints', JSON.stringify(updated));
    }
    
    if (localStorage.getItem('currentSprintId') === id) {
      localStorage.setItem('currentSprintName', newName);
    }
  };

  // ── 工作日誌輔助 ──
  const WEEKDAYS_J = WEEKDAYS_J_MOD;

  function jGetNote(map: Record<number, unknown>, day: number, person: string): string {
    const v = map[day];
    if (!v || typeof v === 'string') return '';
    return (v as Record<string, string>)[person] || '';
  }

  function jDays(tl: unknown): number {
    if (tl === '30d') return 30;
    const n = Number(tl);
    return Number.isFinite(n) && n > 0 ? n * 7 : 30;
  }

  const toggleSprintSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSprintIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleExportJournal = async () => {
    let exportIds = selectedSprintIds;
    if (exportIds.size === 0) {
      const auto = new Set(sprints.filter(isSprintInProgress).map(s => s.id));
      if (auto.size === 0) return;
      setSelectedSprintIds(auto);
      exportIds = auto;
    }
    setShowJournalModal(true);
    setJournalLoading(true);
    setJournalDailyText('');
    setJournalWeeklyText('');

    const now = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const selectedNames = Array.from(exportIds).map(id => sprints.find(s => s.id === id)?.name || id);
    const headerMeta = `產出時間：${now}\nSprint：${selectedNames.join('、')}\n${'='.repeat(50)}\n`;

    const allData: JSprintData[] = [];
    // 跨 sprint 日期聯集，避免重疊時段重複計算容量
    const personDateSets = new Map<string, Set<string>>();

    for (const sprintId of Array.from(exportIds)) {
      const sprint = sprints.find(s => s.id === sprintId);
      const sprintName = sprint?.name || sprintId;
      try {
        const snap = await getDoc(doc(db, 'sprints', sprintId));
        if (!snap.exists()) { allData.push({ name: sprintName, goal: '', totalDays: 0, completionPct: 0, workloads: [], days: [] }); continue; }
        const data = snap.data();
        const planning = data.planning || {};
        const backlog = data.backlog || {};
        const daily = data.daily || {};
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
            dateStr = `${d.getMonth() + 1}/${d.getDate()}`; dowStr = WEEKDAYS_J[d.getDay()];
            isoDate = d.toISOString().slice(0, 10);
          }
          days.push({ idx: i, date: dateStr, isoDate, dow: dowStr, done: !!completedDays[i], entries });
        }
        const dash = dashboards[sprintId];
        const completionPct = dash && dash.totalTasks > 0 ? Math.round(dash.done / dash.totalTasks * 100) : 0;
        // 計算每人工作負荷
        const parseHrs = (t: string) => { if (!t) return 0; const s = t.trim().toLowerCase(); if (s.endsWith('d')) return (parseFloat(s)||0)*8; if (s.endsWith('h')) return parseFloat(s)||0; if (s.endsWith('m')) return (parseFloat(s)||0)/60; return parseFloat(s)||0; };
        const sprintDaysNum = Number(backlog.sprintDays) || totalDays || 14;
        const allTasks: { role?: string; time?: string; status?: string; type?: string; pbiId?: string; id?: string }[] = backlog.tasks || [];
        const pbiIds = new Set(allTasks.filter(t => t.status === 'pbi').map(t => t.id));
        const taskItems = allTasks.filter(t => t.type === 'task' && t.pbiId && pbiIds.has(t.pbiId));
        // 把此 sprint 工作日加入每人的日期聯集
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
      } catch { allData.push({ name: sprintName, goal: '', totalDays: 0, completionPct: 0, workloads: [], days: [] }); }
    }

    // ── 彙總各人跨 Sprint 總負荷（日期聯集，避免重疊時段重複計算）──
    const totalLoadMap = new Map<string, { role: string; assigned: number }>();
    for (const s of allData) {
      for (const w of s.workloads) {
        const cur = totalLoadMap.get(w.name) || { role: w.role, assigned: 0 };
        cur.assigned += w.assigned;
        if (!cur.role && w.role) cur.role = w.role;
        totalLoadMap.set(w.name, cur);
      }
    }
    const totalLoadLines = Array.from(totalLoadMap.entries()).map(([name, v]) => {
      const daySet = personDateSets.get(name);
      const capacity = daySet && daySet.size > 0 ? daySet.size * 8 : 0;
      const pct = capacity > 0 ? Math.round(v.assigned / capacity * 100) : 0;
      return `  ${name}${v.role ? `(${v.role})` : ''}：${pct}%（${v.assigned}h / ${capacity}h）`;
    });

    // ── 儲存原始資料，再由 builder 依選定日期產生文字 ──
    const raw: JournalRawData = { allData, loadLines: totalLoadLines, headerMeta };
    journalRawRef.current = raw;
    const today = new Date();
    // 用本地日期避免 UTC 偏移問題（台灣 UTC+8 在凌晨時 toISOString 會取到前一天）
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    // 本週一～本週日（週一為週首）
    const dow = today.getDay(); // 0=日,1=一,...,6=六
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(today); monday.setDate(today.getDate() + diffToMon);
    const friday = new Date(monday); friday.setDate(monday.getDate() + 4);
    const weekFrom = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    const weekTo = `${friday.getFullYear()}-${String(friday.getMonth() + 1).padStart(2, '0')}-${String(friday.getDate()).padStart(2, '0')}`;
    setJournalDate(todayIso);
    setJournalRangeFrom(weekFrom);
    setJournalRangeTo(weekTo);
    setJournalDailyText(buildDailyText(raw, todayIso));
    setJournalWeeklyText(buildWeeklyText(raw, weekFrom, weekTo));
    setJournalLoading(false);
  };

  const selectSprint = async (id: string, name: string) => {
    localStorage.setItem('currentSprintId', id);
    localStorage.setItem('currentSprintName', name);
    // 根據用戶在此 sprint 的角色決定存取模式
    const sprint = sprints.find(s => s.id === id);
    if (sprint) {
      const isOwner = !sprint.ownerId || sprint.ownerId === user?.uid;
      const collaboratorRole = sprint.collaborators?.find(
        c => c.email.toLowerCase() === (user?.email || '').toLowerCase()
      )?.role;
      if (!isOwner && collaboratorRole === 'viewer') {
        localStorage.setItem('sprintRole_' + id, 'viewer_via_link');
      } else {
        localStorage.removeItem('sprintRole_' + id);
      }
    }
    // 若 sprint 不在清單中（link viewer），viewer_via_link 已在 checkLink 設定
    // 寫入 Firestore，讓 scrum-project-new 同一帳號能讀到同一個 sprintId
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { currentSprintId: id }, { merge: true });
      } catch {}
    }
    window.location.href = `/planning?sprint=${id}`;
  };

  // 已完成的 Sprint 自動沉底，進行中 > 待開始 > 已完成
  const statusOrder: Record<string, number> = { 'in-progress': 0, 'pending': 1, 'completed': 2 };
  const getSortStatus = (s: Sprint) => {
    const d = dashboards[s.id];
    const total = d?.totalTasks ?? 0;
    const td = d?.todo ?? 0;
    const dg = d?.doing ?? 0;
    const auto = (total === 0 || dashLoading) ? 'pending' : (td === 0 && dg === 0) ? 'completed' : dg > 0 ? 'in-progress' : 'pending';
    return s.sprintStatus ?? auto;
  };
  const ownedSprints = (user ? sprints.filter(s => s.ownerId === user.uid || !s.ownerId) : sprints).sort((a, b) => statusOrder[getSortStatus(a)] - statusOrder[getSortStatus(b)]);
  const sharedSprints = (user ? sprints.filter(s => !!(s.ownerId && s.ownerId !== user.uid)) : []).sort((a, b) => statusOrder[getSortStatus(a)] - statusOrder[getSortStatus(b)]);

  return (
    <main className="min-h-screen bg-[#f4f1ea] p-8 font-serif text-[#3e362e] bg-[url('https://www.transparenttextures.com/patterns/rice-paper-2.png')]">
      <div className="w-full space-y-8">
        
        {/* Header */}
        <div className="bg-[#fffdf9] border-4 border-[#5b755e] p-8 rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10 transform translate-x-4 -translate-y-4">
             <span className="text-9xl">📚</span>
          </div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-[#5b755e] drop-shadow-sm flex items-center gap-3">
                <span>📚</span> Sprint 專案大廳
              </h1>
              <p className="text-[#6b5e50] mt-2 font-bold">
                {user 
                  ? `歡迎回來，${user.displayName || '使用者'}！您的專案已同步至雲端。` 
                  : '您目前以訪客身分操作（資料僅存於瀏覽器），登入後即可將專案儲存至雲端！'}
              </p>
            </div>
            
            <div className="flex gap-3">
              {!user ? (
                <button 
                  onClick={signInWithGoogle}
                  className="bg-white text-[#3e362e] px-4 py-3 rounded-xl font-bold shadow-md hover:bg-[#f4f1ea] transition-all border-2 border-[#b5a695] flex items-center gap-2"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                  Google 登入
                </button>
              ) : (
                <button 
                  onClick={logout}
                  className="bg-[#d3cbbd] text-[#6b5e50] px-4 py-3 rounded-xl font-bold shadow-md hover:bg-[#b5a695] hover:text-white transition-all border-2 border-[#b5a695] flex items-center gap-2"
                >
                  登出
                </button>
              )}
              
              {user && (
                <Link
                  href="/report"
                  className="bg-[#5b755e] text-white px-5 py-3 rounded-xl font-bold shadow-md hover:bg-[#4a614d] transition-all hover:-translate-y-1 border-2 border-[#3e5241] flex items-center gap-2"
                >
                  <span>📊</span> 成效報告
                </Link>
              )}
              {(() => {
                const hasInProgress = !dashLoading && sprints.some(isSprintInProgress);
                const canExport = selectedSprintIds.size > 0 || hasInProgress;
                const label = selectedSprintIds.size > 0
                  ? `匯出工作日誌 (${selectedSprintIds.size})`
                  : hasInProgress ? '匯出工作日誌（進行中）' : '匯出工作日誌';
                return (
                  <button
                    onClick={handleExportJournal}
                    disabled={!canExport}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold shadow-md transition-all border-2 ${
                      canExport
                        ? 'bg-[#f2e3c6] text-[#8b5a2b] border-[#d4a373] hover:bg-[#e8d0a8] hover:-translate-y-1'
                        : 'bg-[#ede9e2] text-[#b5a695] border-[#d3cbbd] cursor-not-allowed'
                    }`}
                    title={canExport ? label : '目前無進行中的 Sprint'}
                  >
                    <span>📋</span>
                    {label}
                  </button>
                );
              })()}

              <button
                onClick={createSprint}
                className="bg-[#e07a5f] text-white px-6 py-3 rounded-xl font-bold shadow-md hover:bg-[#c66147] transition-all hover:-translate-y-1 border-2 border-[#8a4231] flex items-center gap-2"
              >
                <span>🌱</span> 建立新 Sprint
              </button>
            </div>
          </div>
        </div>

        {/* ⚙️ 組織設定 */}
        <div className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-lg overflow-hidden">
          <button
            onClick={() => setShowTeamSection(prev => !prev)}
            className="w-full bg-[#5b755e] p-4 flex items-center justify-between text-white font-bold text-lg hover:bg-[#4a614d] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span>⚙️</span><span>組織設定</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm bg-white/20 px-2 py-0.5 rounded-full">{teamMembers.length} 位成員</span>
              <span className="text-sm bg-white/20 px-2 py-0.5 rounded-full">{holidays.length} 筆假日</span>
              <span className="text-sm bg-white/20 px-2 py-0.5 rounded-full">{lineRecipients.length} 位 LINE</span>
              <span className="text-xl">{showTeamSection ? '▲' : '▼'}</span>
            </div>
          </button>

          {showTeamSection && (
            <div className="p-6 space-y-6">
              {/* 三分頁切換 */}
              <div className="flex rounded-xl overflow-hidden border-2 border-[#b5a695] w-fit flex-wrap">
                {([['members','🧑‍💼 成員庫'],['holidays','🎌 國定假日'],['line','📱 LINE 推播']] as const).map(([tab, label], i) => (
                  <button key={tab}
                    onClick={() => { setOrgSettingsTab(tab); if (tab === 'line') loadLineUsers(); }}
                    className={`px-4 py-2 text-sm font-bold transition-colors ${i > 0 ? 'border-l-2 border-[#b5a695]' : ''} ${orgSettingsTab === tab ? 'bg-[#5b755e] text-white' : 'bg-white text-[#5b755e] hover:bg-[#f4f1ea]'}`}
                  >{label}</button>
                ))}
              </div>

              {/* 成員庫 */}
              {orgSettingsTab === 'members' && (
                <div className="space-y-4">
                  {teamMembers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {teamMembers.map(m => (
                        <div key={m.id} className="bg-[#f4f1ea] border-2 border-[#d3cbbd] rounded-xl p-3 flex items-center gap-2 group">
                          <div className="w-9 h-9 rounded-full bg-[#8fb996] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{(m.name||'?').slice(0,1)}</div>
                          <input type="text" value={m.name} onChange={e => updateMemberField(m.id,'name',e.target.value)}
                            className="flex-1 min-w-0 bg-transparent font-bold text-[#3e362e] outline-none border-b border-transparent focus:border-[#8fb996] text-sm" placeholder="姓名" />
                          <button onClick={() => removeMember(m.id)} className="text-[#c96262] opacity-0 group-hover:opacity-100 hover:bg-[#fceded] p-1 rounded transition-all" title="移除">✕</button>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-[#b5a695] text-sm text-center py-2">尚未新增任何成員。</p>}
                  <div className="flex gap-2 items-center flex-wrap">
                    <input type="text" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addMember()}
                      placeholder="輸入成員姓名，按 Enter 新增"
                      className="flex-1 min-w-[180px] px-3 py-2 border-2 border-[#b5a695] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#8fb996]/50 text-sm" />
                    <button onClick={addMember} disabled={!newMemberName.trim()}
                      className="bg-[#8fb996] text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-[#78a07e] transition-all disabled:opacity-40 disabled:cursor-not-allowed border-2 border-[#5b755e] shadow-sm">＋ 新增成員</button>
                  </div>
                </div>
              )}

              {/* 假日 */}
              {orgSettingsTab === 'holidays' && (
                <div className="space-y-4">
                  {holidays.length > 0 ? (
                    <div className="space-y-2">
                      {holidays.map(h => (
                        <div key={h.id} className="bg-[#f4f1ea] border-2 border-[#d3cbbd] rounded-xl px-4 py-2.5 flex items-center gap-3 group">
                          <span className="text-[#e07a5f] font-bold text-sm w-24 flex-shrink-0">{h.date}</span>
                          <span className="flex-1 text-[#3e362e] font-medium text-sm">{h.name}</span>
                          <button onClick={() => removeHoliday(h.id)} className="text-[#c96262] opacity-0 group-hover:opacity-100 hover:bg-[#fceded] px-2 py-1 rounded transition-all text-xs font-bold" title="刪除">✕</button>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-[#b5a695] text-sm text-center py-2">尚未設定任何國定假日。</p>}
                  <div className="flex gap-2 items-center flex-wrap">
                    <input type="date" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)}
                      className="px-3 py-2 border-2 border-[#b5a695] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#8fb996]/50 text-sm" />
                    <input type="text" value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addHoliday()}
                      placeholder="假日名稱，例如：中秋節"
                      className="flex-1 min-w-[160px] px-3 py-2 border-2 border-[#b5a695] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#8fb996]/50 text-sm" />
                    <button onClick={addHoliday} disabled={!newHolidayDate.trim()||!newHolidayName.trim()}
                      className="bg-[#8fb996] text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-[#78a07e] transition-all disabled:opacity-40 disabled:cursor-not-allowed border-2 border-[#5b755e] shadow-sm whitespace-nowrap">＋ 新增假日</button>
                  </div>
                </div>
              )}

              {/* LINE 推播 */}
              {orgSettingsTab === 'line' && (
                <div className="space-y-5">
                  {/* 設定說明 */}
                  <div className="bg-[#e8f0f4] border-2 border-[#76a5af] rounded-2xl px-4 py-3 text-sm text-[#3e4a5e] space-y-1">
                    <p className="font-bold text-[#467386]">📋 設定步驟</p>
                    <p>1. 請確認已在 LINE Developers Console 設定 Webhook URL：</p>
                    <code className="block bg-white px-2 py-1 rounded text-xs font-mono text-[#3e362e] border border-[#c2dce3] select-all">https://scrum-project-red.vercel.app/api/line-webhook</code>
                    <p>2. 收件人掃 QR Code 加 Bot 好友，並傳送任意訊息給 Bot 完成登錄。</p>
                    <p>3. 點「重新整理」載入已登錄成員，勾選後即可接收日誌。</p>
                  </div>

                  {/* 已登錄 LINE 用戶 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-[#5b755e]">已登錄成員（勾選 = 接收日誌）</span>
                      <button onClick={loadLineUsers} disabled={lineUsersLoading}
                        className="text-xs text-[#5b755e] bg-[#e8eedd] border border-[#8fb996] px-3 py-1 rounded-lg hover:bg-[#dcedc1] transition-all disabled:opacity-50">
                        {lineUsersLoading ? '載入中...' : '🔄 重新整理'}
                      </button>
                    </div>
                    {lineUsers.length === 0 ? (
                      <p className="text-[#b5a695] text-sm text-center py-3">尚無人加入 Bot。</p>
                    ) : (
                      <div className="space-y-2">
                        {lineUsers.map(u => (
                          <label key={u.lineUserId} className="flex items-center gap-3 px-3 py-2.5 bg-[#f4f1ea] border-2 border-[#d3cbbd] rounded-xl cursor-pointer hover:bg-[#ece9e2] transition-colors">
                            <input type="checkbox" checked={lineRecipients.includes(u.lineUserId)} onChange={() => toggleLineRecipient(u.lineUserId)}
                              className="w-4 h-4 accent-[#5b755e]" />
                            <div className="w-8 h-8 rounded-full bg-[#76a5af] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                              {u.displayName.slice(0,1)}
                            </div>
                            <span className="font-medium text-sm text-[#3e362e]">{u.displayName}</span>
                            {lineRecipients.includes(u.lineUserId) && <span className="ml-auto text-xs text-[#5b755e] font-bold">✓ 接收日誌</span>}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 定時發送設定 */}
                  <div className="border-t-2 border-[#e8d5b5] pt-4 space-y-3">
                    <p className="font-bold text-sm text-[#5b755e]">⏰ 定時自動發送（台灣時間）</p>
                    <label className="flex items-center gap-3 text-sm">
                      <input type="checkbox" checked={lineSchedule.dailyEnabled} onChange={e => updateLineSchedule({ dailyEnabled: e.target.checked })} className="w-4 h-4 accent-[#5b755e]" />
                      <span className="font-medium text-[#3e362e]">日報：每個工作日</span>
                      <select value={lineSchedule.dailyHour} onChange={e => updateLineSchedule({ dailyHour: Number(e.target.value) })}
                        className="px-2 py-1 border border-[#b5a695] rounded text-sm bg-white">
                        {Array.from({length:16},(_,i)=>i+7).map(h=>(
                          <option key={h} value={h}>{h}:00</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-3 text-sm flex-wrap">
                      <input type="checkbox" checked={lineSchedule.weeklyEnabled} onChange={e => updateLineSchedule({ weeklyEnabled: e.target.checked })} className="w-4 h-4 accent-[#5b755e]" />
                      <span className="font-medium text-[#3e362e]">週報：每週</span>
                      <select value={lineSchedule.weeklyDay} onChange={e => updateLineSchedule({ weeklyDay: Number(e.target.value) })}
                        className="px-2 py-1 border border-[#b5a695] rounded text-sm bg-white">
                        {(['一','二','三','四','五'] as const).map((d,i)=>(
                          <option key={i+1} value={i+1}>週{d}</option>
                        ))}
                      </select>
                      <select value={lineSchedule.weeklyHour} onChange={e => updateLineSchedule({ weeklyHour: Number(e.target.value) })}
                        className="px-2 py-1 border border-[#b5a695] rounded text-sm bg-white">
                        {Array.from({length:16},(_,i)=>i+7).map(h=>(
                          <option key={h} value={h}>{h}:00</option>
                        ))}
                      </select>
                    </label>
                    <p className="text-xs text-[#8a7f72]">⚠ 定時發送會使用「工作日誌」最後一次產生的內容。建議在下班前先開啟日誌確認內容，系統會自動存檔。</p>
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={sendLineTest}
                        disabled={lineTestSending || !lineRecipients.length}
                        className={`px-4 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-40 ${
                          lineTestResult === 'ok' ? 'bg-[#5b755e] text-white' :
                          lineTestResult === 'error' ? 'bg-[#c96262] text-white' :
                          'bg-[#e8eedd] text-[#5b755e] border border-[#8fb996] hover:bg-[#dcedc1]'
                        }`}
                      >
                        {lineTestSending ? '傳送中...' : lineTestResult === 'ok' ? '✅ 測試成功！' : lineTestResult === 'error' ? '❌ 發送失敗' : '📨 測試發送'}
                      </button>
                      {lineTestResult === 'ok' && <span className="text-xs text-[#5b755e]">已傳送測試訊息，請確認手機 LINE 是否收到</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 主管儀表板 */}
        {!loading && sprints.length > 0 && (() => {
          const vals = Object.values(dashboards);
          const totalTasks = vals.reduce((s, d) => s + d.totalTasks, 0);
          const totalDone = vals.reduce((s, d) => s + d.done, 0);
          const totalDoing = vals.reduce((s, d) => s + d.doing, 0);
          const totalTodo = vals.reduce((s, d) => s + d.todo, 0);
          const overallRate = totalTasks > 0 ? Math.round(totalDone / totalTasks * 100) : 0;
          const inProgressCount = sprints.filter(s => {
            const d = dashboards[s.id];
            const total = d?.totalTasks ?? 0;
            const dg = d?.doing ?? 0;
            const td = d?.todo ?? 0;
            const auto = (total === 0 || dashLoading) ? 'pending' : (td === 0 && dg === 0) ? 'completed' : dg > 0 ? 'in-progress' : 'pending';
            return (s.sprintStatus ?? auto) === 'in-progress';
          }).length;
          const pendingCount = sprints.filter(s => {
            const d = dashboards[s.id];
            const total = d?.totalTasks ?? 0;
            const dg = d?.doing ?? 0;
            const td = d?.todo ?? 0;
            const auto = (total === 0 || dashLoading) ? 'pending' : (td === 0 && dg === 0) ? 'completed' : dg > 0 ? 'in-progress' : 'pending';
            return (s.sprintStatus ?? auto) === 'pending';
          }).length;
          return (
            <section className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-xl overflow-hidden">
              <div className="bg-[#5b755e] border-b-4 border-[#3d4f3f] p-4 text-xl font-bold text-white flex items-center justify-between">
                <div className="flex items-center gap-2"><span>📊</span> 主管儀表板</div>
                <div className="flex items-center gap-3">
                  {dashLoading && <div className="text-sm font-normal opacity-70 animate-pulse">載入進度中...</div>}
                  <Link href="/workload" className="text-sm font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5">
                    <span>⚖️</span> 人員負荷分析
                  </Link>
                </div>
              </div>

              <div className="p-4 md:p-6 space-y-6">
                {/* 整體統計卡片 */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-[#e8eedd] border-2 border-[#a5c2a8] rounded-2xl p-4 text-center">
                    <div className="text-3xl font-bold text-[#4a7c59]">{sprints.length}</div>
                    <div className="text-xs font-bold text-[#5b755e] mt-1">📁 Sprint 總數</div>
                  </div>
                  <div className="bg-[#faebce] border-2 border-[#e6c98a] rounded-2xl p-4 text-center">
                    <div className="text-3xl font-bold text-[#d4a373]">{dashLoading ? '—' : inProgressCount}</div>
                    <div className="text-xs font-bold text-[#d4a373] mt-1">⚡ 進行中的 Sprint</div>
                  </div>
                  <div className="bg-[#fceded] border-2 border-[#e6b1b1] rounded-2xl p-4 text-center">
                    <div className="text-3xl font-bold text-[#c96262]">{dashLoading ? '—' : pendingCount}</div>
                    <div className="text-xs font-bold text-[#c96262] mt-1">📋 待開始的 Sprint</div>
                  </div>
                  <div className="bg-[#f2e3c6] border-2 border-[#d4a373] rounded-2xl p-4 text-center">
                    <div className="text-3xl font-bold text-[#8b5a2b]">{dashLoading ? '—' : totalTasks}</div>
                    <div className="text-xs font-bold text-[#8b5a2b] mt-1">🗂 任務總數</div>
                  </div>
                  <div className="bg-[#c2dce3] border-2 border-[#76a5af] rounded-2xl p-4 text-center">
                    <div className="text-3xl font-bold text-[#467386]">{dashLoading ? '—' : `${overallRate}%`}</div>
                    <div className="text-xs font-bold text-[#467386] mt-1">✅ 整體完成率</div>
                  </div>
                </div>

                {/* 整體進度條 */}
                {!dashLoading && totalTasks > 0 && (
                  <div className="space-y-2">
                    <div className="w-full h-4 rounded-full bg-[#e8e4d9] overflow-hidden flex border-2 border-[#b5a695]">
                      {totalDone > 0 && <div style={{ width: `${Math.round(totalDone/totalTasks*100)}%` }} className="bg-[#8fb996] h-full transition-all duration-700" />}
                      {totalDoing > 0 && <div style={{ width: `${Math.round(totalDoing/totalTasks*100)}%` }} className="bg-[#d4a373] h-full transition-all duration-700" />}
                      {totalTodo > 0 && <div style={{ width: `${Math.round(totalTodo/totalTasks*100)}%` }} className="bg-[#e6b1b1] h-full transition-all duration-700" />}
                    </div>
                    <div className="flex gap-4 text-xs font-bold text-[#8a7f72]">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#8fb996] inline-block"/>完成 {totalDone}</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#d4a373] inline-block"/>進行中 {totalDoing}</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#e6b1b1] inline-block"/>待處理 {totalTodo}</span>
                    </div>
                  </div>
                )}


              </div>
            </section>
          );
        })()}

        {/* 專案清單 */}
        {loading ? (
          <div className="text-center py-12 text-[#b5a695] font-bold text-lg flex flex-col items-center gap-4">
            <div>資料載入中...</div>
            {loadTimeout && (
              <div className="text-[#c96262] text-sm bg-[#fceded] p-4 rounded-xl border border-[#e6b1b1] max-w-md">
                ⚠️ 讀取時間似乎有點久。這可能是因為您的網路連線不穩，或是 Firebase 資料庫連線失敗。
                <br /><br />
                您可以嘗試重新整理網頁，或先使用下方的「建立新 Sprint」在本地端操作。
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...ownedSprints, ...sharedSprints].map((sprint, sortIndex) => {
              const isEditing = editingId === sprint.id;
              const isCurrent = typeof window !== 'undefined' && localStorage.getItem('currentSprintId') === sprint.id;
              const isSharedToMe = !!(user && sprint.ownerId && sprint.ownerId !== user.uid);
              const showOwnedHeader = !isSharedToMe && sortIndex === 0 && sharedSprints.length > 0;
              const showSharedHeader = isSharedToMe && sortIndex === ownedSprints.length;

              return (
                <React.Fragment key={sprint.id}>
                {showOwnedHeader && (
                  <div className="col-span-full flex items-center gap-3 mb-1">
                    <div className="h-px flex-1 bg-[#a5c2a8]" />
                    <span className="text-sm font-bold text-[#5b755e] flex items-center gap-1.5 bg-[#e8eedd] px-3 py-1 rounded-full">🗂 我的 Sprint</span>
                    <div className="h-px flex-1 bg-[#a5c2a8]" />
                  </div>
                )}
                {showSharedHeader && (
                  <div className="col-span-full flex items-center gap-3 my-2">
                    <div className="h-px flex-1 bg-[#b8d4ea]" />
                    <span className="text-sm font-bold text-[#4a7c9b] flex items-center gap-1.5 bg-[#dceef8] px-3 py-1 rounded-full">🤝 共享給我的 Sprint</span>
                    <div className="h-px flex-1 bg-[#b8d4ea]" />
                  </div>
                )}
                <div
                  className={`relative group overflow-hidden rounded-2xl border transition-all
                    ${selectedSprintIds.has(sprint.id) ? 'ring-2 ring-[#d4a373] ring-offset-1' : ''}
                    ${isCurrent
                      ? 'bg-[#fffdf9] border-[#e07a5f] shadow-md ring-2 ring-[#e07a5f]/15'
                      : isSharedToMe
                        ? 'bg-[#f0f7ff] border-[#b8d4ea] hover:border-[#6b9ec4] hover:shadow-md hover:-translate-y-0.5'
                        : 'bg-[#fffdf9] border-[#ddd6cc] hover:border-[#8fb996] hover:shadow-md hover:-translate-y-0.5'}
                  `}
                >
                  {/* 工作日誌勾選框 */}
                  <div className="absolute top-2.5 left-2.5 z-20" onClick={e => toggleSprintSelect(sprint.id, e)}>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${
                      selectedSprintIds.has(sprint.id)
                        ? 'bg-[#d4a373] border-[#b08040] text-white'
                        : 'bg-white border-[#d3cbbd] hover:border-[#d4a373]'
                    }`}>
                      {selectedSprintIds.has(sprint.id) && <span className="text-[10px] font-bold">✓</span>}
                    </div>
                  </div>
                  {/* 左側色條 */}
                  <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${isCurrent ? 'bg-[#e07a5f]' : isSharedToMe ? 'bg-[#6b9ec4]' : 'bg-[#8fb996]'}`} />

                  <div className="pl-9 pr-4 pt-4 pb-4 flex flex-col h-full">
                    {/* 頂部：日期 + 狀態徽章 + 操作按鈕 */}
                    {(() => {
                      const status = getSortStatus(sprint);
                      const statusCfg: Record<string, { label: string; cls: string }> = {
                        'in-progress': { label: '進行中', cls: 'bg-[#fff0e0] text-[#c07020] border border-[#f0c080]' },
                        'completed':   { label: '已完成', cls: 'bg-[#e8f4ea] text-[#3a7a4a] border border-[#9acea8]' },
                        'pending':     { label: '待開始', cls: 'bg-[#f4f1ea] text-[#9a9080] border border-[#d8d0c0]' },
                      };
                      const sc = statusCfg[status] ?? statusCfg['pending'];
                      return (
                        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] text-[#b5a695] font-medium leading-none shrink-0" suppressHydrationWarning>
                              {new Date(sprint.createdAt).toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' })}
                            </span>
                            {!dashLoading && (
                              <div onClick={e => e.stopPropagation()}>
                                <select
                                  value={status}
                                  onChange={e => { e.stopPropagation(); updateSprintStatus(sprint.id, e.target.value as Sprint['sprintStatus']); }}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-0 cursor-pointer outline-none shrink-0 ${sc.cls}`}
                                >
                                  <option value="pending">📋 待開始</option>
                                  <option value="in-progress">⚡ 進行中</option>
                                  <option value="completed">✅ 已完成</option>
                                </select>
                              </div>
                            )}
                            {isCurrent && <span className="text-[10px] font-bold text-[#e07a5f] bg-[#fde8e2] px-2 py-0.5 rounded-full border border-[#f0c0b0] shrink-0">當前</span>}
                            {isSharedToMe && <span className="text-[10px] font-bold text-[#4a7c9b] bg-[#dceef8] px-2 py-0.5 rounded-full border border-[#a8d0e8] shrink-0">🤝 共享</span>}
                            {!isSharedToMe && (sprint.collaborators?.length ?? 0) > 0 && (
                              <span className="text-[10px] font-bold text-[#8b5a2b] bg-[#faebce] px-2 py-0.5 rounded-full border border-[#e8c888] shrink-0">👥 {sprint.collaborators!.length}人</span>
                            )}
                          </div>
                          {/* 操作按鈕（hover 才顯示） */}
                          <div className="flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            {!isSharedToMe && (
                              <button onClick={(e) => { e.stopPropagation(); setShareModalSprint(sprint); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#a09080] hover:bg-[#faebce] hover:text-[#8b5a2b] transition-colors text-sm" title="共享設定">👥</button>
                            )}
                            {!isSharedToMe && (
                              <button onClick={(e) => { e.stopPropagation(); copySprint(sprint.id); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#a09080] hover:bg-[#e8f0e8] hover:text-[#4a7c59] transition-colors text-sm" title="複製 Sprint">⎘</button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); setEditingId(isEditing ? null : sprint.id); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#a09080] hover:bg-[#e8eedd] hover:text-[#5b755e] transition-colors text-sm" title="編輯名稱">✎</button>
                            {!isSharedToMe && (
                              <button onClick={(e) => { e.stopPropagation(); deleteSprint(sprint.id); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#a09080] hover:bg-[#fceded] hover:text-[#c96262] transition-colors text-sm" title="刪除">✕</button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Sprint 名稱（min-h 鎖住兩行高度，避免 h2↔input 切換時版面跳動） */}
                    <div className="mb-3 min-h-[44px] flex items-start">
                      {isEditing ? (
                        <input
                          type="text"
                          value={sprint.name}
                          onChange={(e) => updateSprintName(sprint.id, e.target.value)}
                          onBlur={() => setEditingId(null)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setEditingId(null); } }}
                          autoFocus
                          className="w-full px-0 border-b-2 border-[#5b755e] focus:outline-none text-[#3e362e] font-bold text-[15px] leading-snug bg-transparent"
                        />
                      ) : (
                        <h2 className="font-bold text-[#3e362e] text-[15px] leading-snug line-clamp-2 w-full">{sprint.name}</h2>
                      )}
                    </div>

                    {/* Sprint Goal */}
                    {!isEditing && dashboards[sprint.id]?.sprintGoal && (
                      <p className="text-[11px] text-[#8a7f72] line-clamp-2 mb-3 leading-relaxed bg-[#f9f6f0] px-2.5 py-1.5 rounded-lg border-l-2 border-[#c8b89a]">
                        {dashboards[sprint.id].sprintGoal}
                      </p>
                    )}

                    {/* 進度條 + 任務統計 */}
                    {!isEditing && (
                      <div className="mb-3 flex-1">
                        {dashLoading ? (
                          <div className="space-y-1.5">
                            <div className="h-1.5 bg-[#f0ebe4] rounded-full animate-pulse w-full" />
                            <div className="h-1.5 bg-[#f0ebe4] rounded-full animate-pulse w-2/3" />
                          </div>
                        ) : dashboards[sprint.id] && dashboards[sprint.id].totalTasks > 0 ? (
                          <>
                            {/* 進度條 */}
                            <div className="mb-2">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] text-[#b5a695]">任務完成率</span>
                                <span className="text-[10px] font-bold text-[#5b755e]">
                                  {Math.round(dashboards[sprint.id].done / dashboards[sprint.id].totalTasks * 100)}%
                                </span>
                              </div>
                              <div className="h-2 bg-[#f0ebe4] rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${Math.round(dashboards[sprint.id].done / dashboards[sprint.id].totalTasks * 100)}%`, background: getSortStatus(sprint) === 'completed' ? '#5b755e' : '#8fb996' }}
                                />
                              </div>
                            </div>
                            {/* 任務數量 */}
                            <div className="flex items-center gap-3 text-[11px]">
                              <span className="flex items-center gap-1 font-bold text-[#5b755e]" title="已完成">✓ {dashboards[sprint.id].done}</span>
                              <span className="flex items-center gap-1 font-bold text-[#e07a5f]" title="進行中">▶ {dashboards[sprint.id].doing}</span>
                              <span className="flex items-center gap-1 text-[#b5a695]" title="待處理">○ {dashboards[sprint.id].todo}</span>
                              {dashboards[sprint.id].pbiTotal > 0 && (
                                <span className="ml-auto text-[10px] text-[#8a7f72] bg-[#f4f0e8] px-2 py-0.5 rounded-full border border-[#e0d8cc]">
                                  PBI {dashboards[sprint.id].pbiAccepted}/{dashboards[sprint.id].pbiTotal}
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="text-[11px] text-[#d3cbbd] italic py-1">尚無任務資料</div>
                        )}
                      </div>
                    )}

                    {/* 底部：日期範圍 + 進入按鈕 */}
                    {!isEditing && (
                      <div className="border-t border-[#f0ebe4] pt-3 flex items-center justify-between gap-2 mt-auto">
                        <div className="text-[10px] text-[#c0b8ac] leading-tight">
                          {dashboards[sprint.id]?.startDate ? (
                            <span>📅 {dashboards[sprint.id].startDate}{dashboards[sprint.id].endDate ? ` → ${dashboards[sprint.id].endDate}` : ''}</span>
                          ) : null}
                        </div>
                        <button
                          onClick={() => selectSprint(sprint.id, sprint.name)}
                          className={`flex items-center gap-1.5 text-[13px] font-bold px-4 py-1.5 rounded-lg transition-all shrink-0
                            ${isCurrent
                              ? 'bg-[#e07a5f] text-white hover:bg-[#c66147] shadow-sm'
                              : 'bg-[#eef6ef] text-[#5b755e] hover:bg-[#d4edda] border border-[#c0dcc4]'}
                          `}
                        >
                          {isCurrent ? '繼續編輯' : '進入'}
                          <span className="text-[11px]">→</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                </React.Fragment>
              );
            })}

            {sprints.length === 0 && (
              <div className="col-span-full text-center py-12 text-[#b5a695] font-bold text-lg bg-[#fffdf9] border-2 border-dashed border-[#d3cbbd] rounded-2xl">
                🪹 目前還沒有任何 Sprint，點擊右上角建立一個吧！
              </div>
            )}
          </div>
        )}
      
        {/* 工作日誌匯出 Modal */}
        {showJournalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowJournalModal(false)}>
            <div className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              {/* 標題列 */}
              <div className="bg-[#5b755e] text-white px-6 py-4 rounded-t-2xl flex items-center justify-between gap-3 flex-shrink-0 flex-wrap">
                <div>
                  <h2 className="font-bold text-lg">📋 工作日誌</h2>
                  <div className="text-sm text-white/70 mt-0.5">已選 {selectedSprintIds.size} 個 Sprint</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* 日報 / 週報 切換 */}
                  <div className="flex rounded-xl overflow-hidden border-2 border-white/30">
                    <button
                      onClick={() => setJournalType('daily')}
                      className={`px-3 py-1.5 text-sm font-bold transition-colors ${journalType === 'daily' ? 'bg-white text-[#5b755e]' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                    >日報</button>
                    <button
                      onClick={() => setJournalType('weekly')}
                      className={`px-3 py-1.5 text-sm font-bold transition-colors border-l border-white/30 ${journalType === 'weekly' ? 'bg-white text-[#5b755e]' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                    >週報</button>
                  </div>
                  {/* 日期選擇器 */}
                  {!journalLoading && journalType === 'daily' && (
                    <input
                      type="date"
                      value={journalDate}
                      onChange={e => setJournalDate(e.target.value)}
                      className="px-2 py-1 rounded-lg text-sm text-[#3e362e] font-medium bg-white border-0 focus:outline-none focus:ring-2 focus:ring-white/60"
                    />
                  )}
                  {!journalLoading && journalType === 'weekly' && (
                    <div className="flex items-center gap-1 text-sm text-white/80">
                      <input
                        type="date"
                        value={journalRangeFrom}
                        onChange={e => setJournalRangeFrom(e.target.value)}
                        className="px-2 py-1 rounded-lg text-sm text-[#3e362e] font-medium bg-white border-0 focus:outline-none focus:ring-2 focus:ring-white/60"
                      />
                      <span className="flex-shrink-0">—</span>
                      <input
                        type="date"
                        value={journalRangeTo}
                        onChange={e => setJournalRangeTo(e.target.value)}
                        className="px-2 py-1 rounded-lg text-sm text-[#3e362e] font-medium bg-white border-0 focus:outline-none focus:ring-2 focus:ring-white/60"
                      />
                    </div>
                  )}
                  {!journalLoading && (
                    <button
                      onClick={() => {
                        const text = journalType === 'daily' ? journalDailyText : journalWeeklyText;
                        navigator.clipboard.writeText(text).then(() => {
                          setJournalCopied(true);
                          setTimeout(() => setJournalCopied(false), 2500);
                        });
                      }}
                      className={`px-4 py-1.5 rounded-xl font-bold text-sm transition-all ${
                        journalCopied ? 'bg-[#8fb996] text-white' : 'bg-white text-[#5b755e] hover:bg-[#f0f4ec]'
                      }`}
                    >
                      {journalCopied ? '✅ 已複製！' : '📋 複製'}
                    </button>
                  )}
                  {!journalLoading && lineRecipients.length > 0 && (
                    <button
                      onClick={sendLineJournal}
                      disabled={lineSending}
                      className={`px-4 py-1.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 ${
                        lineSent ? 'bg-[#76a5af] text-white' : 'bg-white text-[#5b755e] hover:bg-[#f0f4ec]'
                      }`}
                    >
                      {lineSending ? '傳送中...' : lineSent ? '✅ 已傳送！' : '📱 傳 LINE'}
                    </button>
                  )}
                  <button onClick={() => setShowJournalModal(false)} className="text-white/70 hover:text-white text-xl font-bold leading-none ml-1">✕</button>
                </div>
              </div>
              {/* 內容 */}
              <div className="flex-1 overflow-y-auto p-4">
                {journalLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4 text-[#8a7f72]">
                    <div className="text-4xl animate-spin">⏳</div>
                    <div className="font-bold">讀取中，請稍候...</div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* 人員總負荷 */}
                    {journalRawRef.current && journalRawRef.current.loadLines.length > 0 && (
                      <div className="mb-4 bg-[#e8eedd] border-2 border-[#8fb996] rounded-2xl p-3">
                        <div className="text-xs font-bold text-[#3e6b47] mb-2 flex items-center gap-1.5">
                          <span>👥</span> 人員總負荷
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {journalRawRef.current.loadLines.map((line, li) => (
                            <div key={li} className="text-xs text-[#3e362e] bg-white border border-[#8fb996] px-3 py-1.5 rounded-xl shadow-sm">
                              {line.trim()}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Sprint 卡片 */}
                    {journalRawRef.current && journalRawRef.current.allData.map((sprint, si) => {
                      const filteredDays = sprint.days.filter(day => {
                        if (journalType === 'daily') {
                          const d = new Date(journalDate);
                          const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
                          return day.isoDate === journalDate || (!day.isoDate && day.date === dateStr);
                        }
                        if (!journalRangeFrom && !journalRangeTo) return true;
                        if (!day.isoDate) return true;
                        if (journalRangeFrom && day.isoDate < journalRangeFrom) return false;
                        if (journalRangeTo && day.isoDate > journalRangeTo) return false;
                        return true;
                      });

                      const dayContent = filteredDays.length === 0 ? (
                        <div className="py-6 text-center text-sm text-[#b5a695]">（選定期間無 Daily Scrum 紀錄）</div>
                      ) : journalType === 'daily' ? (
                        <div className="space-y-3">
                          {filteredDays.map((day, di) => {
                            const activeEntries = day.entries.filter(e => e.q1 || e.q2 || e.q3);
                            return (
                              <div key={di}>
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl text-sm font-bold border border-b-0 ${day.done ? 'bg-[#e8eedd] text-[#3e6b47] border-[#8fb996]' : 'bg-[#f4f1ea] text-[#6b5e50] border-[#e8d5b5]'}`}>
                                  <span>{day.done ? '✅' : '○'}</span>
                                  <span>Day {day.idx + 1} / {sprint.totalDays}</span>
                                  {day.date && <span className="font-normal text-[#8a7f72] ml-1">{day.date} ({day.dow})</span>}
                                </div>
                                {activeEntries.length === 0 ? (
                                  <div className="px-3 py-4 text-xs text-[#b5a695] bg-[#fafaf7] border border-[#e8d5b5] rounded-b-xl">（本日站會完成，無文字記錄）</div>
                                ) : (
                                  <div className="bg-[#fafaf7] border border-[#e8d5b5] rounded-b-xl p-3 space-y-2.5">
                                    {activeEntries.map((e, ei) => (
                                      <div key={ei} className="bg-white border border-[#e8d5b5] rounded-xl p-3 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                          <div className="w-7 h-7 rounded-full bg-[#5b755e] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{e.name.charAt(0)}</div>
                                          <span className="font-bold text-sm text-[#3e362e]">{e.name}</span>
                                          {e.role && <span className="text-xs bg-[#f4f1ea] text-[#6b5e50] px-2 py-0.5 rounded-full border border-[#d3cbbd]">{e.role}</span>}
                                        </div>
                                        <div className="space-y-1.5 pl-1">
                                          {e.q1 && (
                                            <div className="flex gap-2">
                                              <span className="flex-shrink-0 text-[10px] font-bold bg-[#e8f5e9] text-[#2e7d32] border border-[#a5d6a7] px-1.5 py-0.5 rounded mt-0.5">昨天</span>
                                              <span className="text-xs text-[#3e362e] leading-relaxed whitespace-pre-wrap">{e.q1}</span>
                                            </div>
                                          )}
                                          {e.q2 && (
                                            <div className="flex gap-2">
                                              <span className="flex-shrink-0 text-[10px] font-bold bg-[#e3f2fd] text-[#1565c0] border border-[#90caf9] px-1.5 py-0.5 rounded mt-0.5">今天</span>
                                              <span className="text-xs text-[#3e362e] leading-relaxed whitespace-pre-wrap">{e.q2}</span>
                                            </div>
                                          )}
                                          {e.q3 && (
                                            <div className="flex gap-2">
                                              <span className="flex-shrink-0 text-[10px] font-bold bg-[#fff3e0] text-[#e65100] border border-[#ffcc80] px-1.5 py-0.5 rounded mt-0.5">阻礙</span>
                                              <span className="text-xs text-[#3e362e] leading-relaxed whitespace-pre-wrap">{e.q3}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* 週報：按週分組 */
                        (() => {
                          const maxIdx = Math.max(...filteredDays.map(d => d.idx));
                          const numWeeks = Math.ceil((maxIdx + 1) / 7);
                          return (
                            <div className="space-y-3">
                              {Array.from({ length: numWeeks }, (_, w) => {
                                const weekDays = filteredDays.filter(d => d.idx >= w * 7 && d.idx < (w + 1) * 7);
                                if (weekDays.length === 0) return null;
                                const wStart = weekDays[0]; const wEnd = weekDays[weekDays.length - 1];
                                const wRange = wStart.date ? `${wStart.date} (${wStart.dow}) — ${wEnd.date} (${wEnd.dow})` : `Day ${w*7+1} — Day ${Math.min((w+1)*7, maxIdx+1)}`;
                                const personNames = Array.from(new Set(weekDays.flatMap(d => d.entries.map(e => e.name))));
                                return (
                                  <div key={w} className="border border-[#d3cbbd] rounded-xl overflow-hidden">
                                    <div className="bg-[#d3cbbd] text-[#3e362e] px-3 py-2 font-bold text-xs flex items-center gap-2">
                                      <span>📅</span>
                                      <span>第 {w + 1} 週</span>
                                      <span className="font-normal text-[#6b5e50]">{wRange}</span>
                                    </div>
                                    <div className="p-3 space-y-2.5 bg-[#fafaf7]">
                                      {personNames.map(name => {
                                        const pDays = weekDays
                                          .map(d => ({ ...d, e: d.entries.find(e => e.name === name) || { name, role: '', q1: '', q2: '', q3: '' } }))
                                          .filter(d => d.e.q1 || d.e.q2 || d.e.q3);
                                        if (pDays.length === 0) return null;
                                        const personRole = pDays[0]?.e?.role || '';
                                        const accs = pDays.filter(d => d.e.q1);
                                        const lastQ2 = [...pDays].reverse().find(d => d.e.q2);
                                        const imps = pDays.filter(d => d.e.q3 && d.e.q3 !== '無');
                                        return (
                                          <div key={name} className="bg-white border border-[#e8d5b5] rounded-xl p-3 shadow-sm">
                                            <div className="flex items-center gap-2 mb-2.5">
                                              <div className="w-7 h-7 rounded-full bg-[#5b755e] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{name.charAt(0)}</div>
                                              <span className="font-bold text-sm text-[#3e362e]">{name}</span>
                                              {personRole && <span className="text-xs bg-[#f4f1ea] text-[#6b5e50] px-2 py-0.5 rounded-full border border-[#d3cbbd]">{personRole}</span>}
                                            </div>
                                            <div className="space-y-2 pl-1">
                                              {accs.length > 0 && (
                                                <div>
                                                  <div className="text-[10px] font-bold text-[#2e7d32] mb-1">📝 本週完成</div>
                                                  <div className="space-y-1">
                                                    {accs.map((d, ai) => (
                                                      <div key={ai} className="text-xs text-[#3e362e] bg-[#f1f8f1] border border-[#c8e6c9] rounded-lg px-2 py-1 flex gap-2">
                                                        {d.date && <span className="flex-shrink-0 text-[#5b755e] font-medium">{d.date} ({d.dow})</span>}
                                                        <span className="whitespace-pre-wrap">{d.e.q1}</span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                              {lastQ2 && (
                                                <div className="text-xs bg-[#e3f2fd] border border-[#90caf9] rounded-lg px-2 py-1.5">
                                                  <div className="text-[10px] font-bold text-[#1565c0] mb-0.5">🎯 下週計劃</div>
                                                  <span className="text-[#3e362e] whitespace-pre-wrap">{lastQ2.e.q2}</span>
                                                </div>
                                              )}
                                              {imps.length > 0 ? (
                                                <div>
                                                  <div className="text-[10px] font-bold text-[#e65100] mb-1">⚠️ 本週阻礙</div>
                                                  <div className="space-y-1">
                                                    {imps.map((d, ii) => (
                                                      <div key={ii} className="text-xs text-[#3e362e] bg-[#fff3e0] border border-[#ffcc80] rounded-lg px-2 py-1 flex gap-2">
                                                        {d.date && <span className="flex-shrink-0 text-[#e65100] font-medium">{d.date} ({d.dow})</span>}
                                                        <span className="whitespace-pre-wrap">{d.e.q3}</span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              ) : (
                                                <div className="text-xs text-[#b5a695] bg-[#f4f1ea] border border-[#e8d5b5] rounded-lg px-2 py-1.5">⚠️ 本週阻礙：無</div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()
                      );

                      return (
                        <div key={si} className="mb-4 border-2 border-[#5b755e] rounded-2xl overflow-hidden shadow-sm">
                          <div className="bg-[#5b755e] text-white px-4 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-sm">{sprint.name}</span>
                              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{sprint.completionPct}% 完成</span>
                            </div>
                            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                              <div className="h-full bg-white rounded-full" style={{ width: `${sprint.completionPct}%` }} />
                            </div>
                          </div>
                          {sprint.goal && (
                            <div className="bg-[#f4f1ea] border-b border-[#e8d5b5] px-4 py-2 text-xs text-[#6b5e50]">
                              🎯 <span className="font-bold">Sprint Goal：</span>{sprint.goal}
                            </div>
                          )}
                          <div className="p-3">{dayContent}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="px-4 pb-4 flex-shrink-0 text-center text-xs text-[#b5a695]">
                使用上方「複製」可取得純文字版本，方便貼到 LINE 或其他通訊工具
              </div>
            </div>
          </div>
        )}

        {/* Share Modal */}
        {shareModalSprint && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl p-6 shadow-2xl max-w-md w-full relative">
               <button onClick={() => setShareModalSprint(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold text-xl">✕</button>
               <h2 className="text-xl font-bold text-[#5b755e] mb-4 flex items-center gap-2"><span>👥</span> 共享專案</h2>
               <p className="text-sm font-bold text-[#6b5e50] mb-4">專案名稱：{shareModalSprint.name}</p>
               
               
               <div className="bg-[#e8eedd] border-2 border-[#5b755e] rounded-xl p-4 mb-4">
                  <h3 className="font-bold text-sm text-[#3e362e] mb-2 flex justify-between items-center">
                    專案專屬網址（公開檢視）
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/?sprint=${shareModalSprint.id}`;
                        navigator.clipboard.writeText(url);
                        alert('已複製連結！\n任何人（包含未登入訪客）只要取得此連結即可進入檢視此專案內容。');
                      }}
                      className="text-xs bg-white border-2 border-[#5b755e] px-2 py-1 rounded-lg text-[#5b755e] hover:bg-[#5b755e] hover:text-white transition-colors shadow-sm"
                    >
                      📋 複製
                    </button>
                  </h3>
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/?sprint=${shareModalSprint.id}`}
                    className="w-full p-2 border-2 border-[#b5a695] rounded-lg bg-white text-xs text-[#6b5e50] outline-none focus:border-[#5b755e]"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <p className="text-[10px] text-[#6b5e50] mt-2 leading-relaxed">
                    💡 收到此連結的人 <b>不需要登入</b> 就能進入檢視；只有擁有者及下方協作者才能編輯。
                  </p>
               </div>

               <div className="bg-[#f4f1ea] border-2 border-[#b5a695] rounded-xl p-4 mb-4">
                  <h3 className="font-bold text-sm text-[#3e362e] mb-2">已加入的協作者</h3>
                  {(!shareModalSprint.collaborators || shareModalSprint.collaborators.length === 0) ? (
                    <div className="text-xs text-[#8a7f72] py-2">目前沒有協作者</div>
                  ) : (
                    <ul className="space-y-2">
                       {shareModalSprint.collaborators.map(c => (
                         <li key={c.email} className="flex justify-between items-center text-sm font-bold bg-white px-3 py-2 border border-[#d3cbbd] rounded-lg">
                           <span className="truncate flex-1 text-[#3e362e]">{c.email}</span>
                           <span className="text-xs px-2 py-1 bg-[#e8eedd] text-[#4a7c59] rounded mx-2">{c.role === 'editor' ? '編輯' : '檢視'}</span>
                           <button onClick={() => handleRemoveCollaborator(c.email)} className="text-red-500 hover:text-red-700">🗑️</button>
                         </li>
                       ))}
                    </ul>
                  )}
               </div>
               
               <div className="space-y-3">
                 <h3 className="font-bold text-sm text-[#3e362e]">新增協作者 (Google Email)</h3>
                 <p className="text-[10px] text-[#8a7f72] bg-[#f9f6f2] border border-[#e8d5b5] rounded-lg px-3 py-2 leading-relaxed">
                   💡 輸入對方的 Google Email 後點擊「邀請加入」。對方以該 Google 帳號登入後，即可在主頁看到共享的 Sprint。
                 </p>
                 <div className="flex gap-2">
                   <input 
                     type="email" 
                     value={shareEmail} 
                     onChange={e => setShareEmail(e.target.value)} 
                     placeholder="輸入Email..."
                     className="flex-1 p-2 border-2 border-[#b5a695] rounded-lg focus:outline-none focus:border-[#5b755e] font-bold text-sm"
                   />
                   <select 
                     value={shareRole} 
                     onChange={e => setShareRole(e.target.value as 'editor'|'viewer')}
                     className="p-2 border-2 border-[#b5a695] rounded-lg bg-white focus:outline-none font-bold text-sm text-[#6b5e50]"
                   >
                     <option value="editor">編輯</option>
                     <option value="viewer">檢視</option>
                   </select>
                 </div>
                 <button 
                   onClick={handleAddCollaborator}
                   className="w-full bg-[#5b755e] text-white font-bold py-2 rounded-lg hover:bg-[#4a614d] transition-colors"
                 >
                   邀請加入
                 </button>
               </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
