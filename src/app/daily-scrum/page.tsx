"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';

function AutoGrowTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };
  useEffect(() => { resize(); }, [props.value]);
  return <textarea ref={ref} {...props} onInput={resize} />;
}
import { useAutoSave } from '@/hooks/useAutoSave';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import ScrumTooltip from '@/components/ScrumTooltip';
import SaveIndicator from '@/components/SaveIndicator';
import CountdownTimer from '@/components/CountdownTimer';

interface BacklogTask {
  id: string;
  type: 'pbi' | 'task';
  status: 'pbi' | 'todo' | 'doing' | 'done' | 'accepted';
  title: string;
  role?: string;
  time?: string;
  pbiId?: string;
  desc?: string;
}

export default function DailyScrum() {
  const [sprintDays, setSprintDays] = useState<number>(30);

  const { data, updateData, loading, saveStatus, forceSave } = useAutoSave('daily', {
    completedDays: [] as boolean[],
    dailyNotes: {} as Record<number, string>,
    dailyNotesQ1: {} as Record<number, string>,
    dailyNotesQ2: {} as Record<number, string>,
    dailyNotesQ3: {} as Record<number, string>
  });

  const dailyNotes = data.dailyNotes || {};
  const dailyNotesQ1 = data.dailyNotesQ1 || {};
  const dailyNotesQ2 = data.dailyNotesQ2 || {};
  const dailyNotesQ3 = data.dailyNotesQ3 || {};
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [collapsedPrevDays, setCollapsedPrevDays] = useState<Set<number>>(new Set());
  const togglePrevDay = (day: number) => setCollapsedPrevDays(prev => {
    const next = new Set(prev);
    if (next.has(day)) { next.delete(day); } else { next.add(day); }
    return next;
  });

  const [sprintStartDate, setSprintStartDate] = useState<string>('');
  const [devNames, setDevNames] = useState<string[]>([]);
  const [backlogTasks, setBacklogTasks] = useState<BacklogTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskBoardExpanded, setTaskBoardExpanded] = useState(true);
  const [taskGroupBy, setTaskGroupBy] = useState<'person' | 'status'>('status');
  const [holidays, setHolidays] = useState<{ id: string; date: string; name: string }[]>([]);

  useEffect(() => {
    const savedDays = localStorage.getItem('sprintDays');
    setSprintDays(savedDays ? Number(savedDays) : 30);
    try {
      const raw = localStorage.getItem('orgHolidays');
      if (raw) setHolidays(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    const sprintId = localStorage.getItem('currentSprintId');
    if (!sprintId) return;
    const timeLimitToDays = (tl: unknown): number | null => {
      if (tl === '30d') return 30;
      const n = Number(tl);
      if (!Number.isFinite(n) || n <= 0) return null;
      return n * 7;
    };
    const load = async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const snap = await getDoc(doc(db, 'sprints', sprintId));
        if (snap.exists()) {
          const planning = snap.data().planning;
          if (planning?.startDate) {
            setSprintStartDate(planning.startDate);
          }
          // 載入開發人員名單
          const rawDevs: string[] =
            Array.isArray(planning?.devsList) && planning.devsList.length > 0
              ? planning.devsList.map((d: { name: string }) => d.name).filter(Boolean)
              : typeof planning?.devs === 'string' && planning.devs
                ? planning.devs.split(',').map((n: string) => n.trim()).filter(Boolean)
                : [];
          setDevNames(rawDevs);
          const days = timeLimitToDays(planning?.timeLimit);
          if (days) {
            setSprintDays(days);
            localStorage.setItem('sprintDays', String(days));
          }
        }
      } catch {}
    };
    load();
  }, []);

  const WEEKDAYS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

  const getDayDate = (dayIndex: number): string => {
    if (!sprintStartDate) return '';
    const base = new Date(sprintStartDate);
    base.setDate(base.getDate() + dayIndex);
    return `${base.getMonth() + 1}/${base.getDate()}`;
  };

  const getDayIso = (dayIndex: number): string => {
    if (!sprintStartDate) return '';
    const base = new Date(sprintStartDate);
    base.setDate(base.getDate() + dayIndex);
    return base.toISOString().slice(0, 10);
  };

  const getHoliday = (dayIndex: number) => {
    const iso = getDayIso(dayIndex);
    if (!iso) return null;
    return holidays.find(h => h.date === iso) || null;
  };

  const getDayOfWeek = (dayIndex: number): string => {
    if (!sprintStartDate) return '';
    const base = new Date(sprintStartDate);
    base.setDate(base.getDate() + dayIndex);
    return WEEKDAYS[base.getDay()];
  };

  // 本地 derive：若 Firebase 尚未有 completedDays 或長度不對，做 padding/truncate
  // 保留既有勾選狀態，避免天數變動時所有打勾被清空
  const completedDays: boolean[] = (() => {
    const stored = data.completedDays || [];
    const result = Array(sprintDays).fill(false);
    for (let i = 0; i < Math.min(stored.length, sprintDays); i++) {
      result[i] = !!stored[i];
    }
    return result;
  })();

  // 取得某天某問題某人的值（支援 object 和舊版 string 兩種格式）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getPersonNote = (notes: Record<number, string>, dayIdx: number, person: string): string => {
    const v = (notes as Record<number, unknown>)[dayIdx];
    if (!v || typeof v === 'string') return '';
    return (v as Record<string, string>)[person] || '';
  };

  // 逐人更新紀錄（儲存為 {人名: 內容} 物件）
  const updatePersonNote = (dayIdx: number, key: 'Q1' | 'Q2' | 'Q3', person: string, text: string) => {
    const notesKey = `dailyNotes${key}` as 'dailyNotesQ1' | 'dailyNotesQ2' | 'dailyNotesQ3';
    updateData(prev => {
      const current = ((prev[notesKey] || {}) as Record<number, unknown>);
      const existing = current[dayIdx];
      const dayData: Record<string, string> = (existing && typeof existing === 'object') ? { ...(existing as Record<string, string>) } : {};
      dayData[person] = text;
      return { [notesKey]: { ...current, [dayIdx]: dayData } };
    });
  };

  const updateSpecificNote = (index: number, key: 'Q1' | 'Q2' | 'Q3', text: string) => {
    if (key === 'Q1') {
      updateData(prev => ({ dailyNotesQ1: { ...(prev.dailyNotesQ1 || {}), [index]: text } }));
    } else if (key === 'Q2') {
      updateData(prev => ({ dailyNotesQ2: { ...(prev.dailyNotesQ2 || {}), [index]: text } }));
    } else if (key === 'Q3') {
      updateData(prev => ({ dailyNotesQ3: { ...(prev.dailyNotesQ3 || {}), [index]: text } }));
    }
  };

  const handleSaveDay = (dayIndex: number) => {
    const stored = data.completedDays || [];
    const merged = stored.length >= sprintDays
      ? [...stored]
      : [...stored, ...Array(sprintDays - stored.length).fill(false)];
    merged[dayIndex] = true;
    updateData({ completedDays: merged });
    setTimeout(() => forceSave(), 100);
  };

  const toggleDay = (index: number) => {
    setActiveDay(index === activeDay ? null : index);
  };
  
  const toggleCheck = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    // 從原始 stored 開始，保留超過 sprintDays 的歷史資料，避免縮短週期時遺失
    const stored = data.completedDays || [];
    const merged = stored.length >= sprintDays
      ? [...stored]
      : [...stored, ...Array(sprintDays - stored.length).fill(false)];
    merged[index] = !merged[index];
    updateData({ completedDays: merged });
  };

  // 載入 backlog 任務
  const loadBacklogTasks = useCallback(async () => {
    const sprintId = localStorage.getItem('currentSprintId');
    if (!sprintId) return;
    setLoadingTasks(true);
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const snap = await getDoc(doc(db, 'sprints', sprintId));
      if (snap.exists()) {
        const tasks: BacklogTask[] = snap.data().backlog?.tasks || [];
        const pbiIds = new Set(tasks.filter(t => t.status === 'pbi').map(t => t.id));
        setBacklogTasks(tasks.filter(t => t.type === 'task' && t.pbiId && pbiIds.has(t.pbiId)));
      }
    } catch {}
    setLoadingTasks(false);
  }, []);

  useEffect(() => { loadBacklogTasks(); }, [loadBacklogTasks]);

  // 切換任務狀態：todo → doing → done → todo
  const cycleStatus = async (taskId: string) => {
    const sprintId = localStorage.getItem('currentSprintId');
    if (!sprintId) return;
    const cycle: Record<string, BacklogTask['status']> = { todo: 'doing', doing: 'done', done: 'todo' };
    const task = backlogTasks.find(t => t.id === taskId);
    if (!task || task.status === 'accepted' || task.status === 'pbi') return;
    const next = cycle[task.status] ?? 'todo';
    // 樂觀更新 local state
    setBacklogTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: next } : t));
    try {
      const { doc, getDoc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const ref = doc(db, 'sprints', sprintId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const allTasks: BacklogTask[] = snap.data().backlog?.tasks || [];
      const updated = allTasks.map(t => t.id === taskId ? { ...t, status: next } : t);
      await updateDoc(ref, { 'backlog.tasks': updated });
    } catch {
      // 回滾
      setBacklogTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
    }
  };

  // 任務按人員分組
  const tasksByPerson = (() => {
    const map = new Map<string, BacklogTask[]>();
    backlogTasks.forEach(t => {
      const assignees = t.role ? t.role.split(',').map(r => r.trim()).filter(Boolean) : ['（未指派）'];
      assignees.forEach(name => {
        if (!map.has(name)) map.set(name, []);
        map.get(name)!.push(t);
      });
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'zh-TW'));
  })();

  // 任務按狀態分組
  const tasksByStatus = [
    { key: 'todo', label: '待辦', color: 'bg-[#e8e4d9] text-[#6b5e50] border-[#d3cbbd]', tasks: backlogTasks.filter(t => t.status === 'todo') },
    { key: 'doing', label: '進行中', color: 'bg-[#faebce] text-[#8b5a2b] border-[#d4a373]', tasks: backlogTasks.filter(t => t.status === 'doing') },
    { key: 'done', label: '完成', color: 'bg-[#e8eedd] text-[#4a7c59] border-[#8fb996]', tasks: backlogTasks.filter(t => t.status === 'done' || t.status === 'accepted') },
  ];

  const statusBadge = (status: string) => {
    if (status === 'done' || status === 'accepted') return { label: status === 'accepted' ? '✅ 驗收' : '✅ 完成', cls: 'bg-[#e8eedd] text-[#4a7c59] border-[#8fb996]' };
    if (status === 'doing') return { label: '🔄 進行中', cls: 'bg-[#faebce] text-[#8b5a2b] border-[#d4a373]' };
    return { label: '⬜ 待辦', cls: 'bg-[#e8e4d9] text-[#6b5e50] border-[#d3cbbd]' };
  };

  return (
    <main className="min-h-screen bg-[#f4f1ea] p-8 font-serif text-[#3e362e] bg-[url('https://www.transparenttextures.com/patterns/rice-paper-2.png')]">
      <div className="w-full space-y-8">
        
        <div className="flex items-center justify-between">
          <Navigation />
          <SaveIndicator status={saveStatus} />
        </div>

        {/* Loading Overlay */}
        {loading && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"><div className="bg-white px-6 py-4 rounded-xl font-bold text-[#5b755e] shadow-xl text-lg flex items-center gap-3"><span>💾</span> <span>載入資料中...</span></div></div>}

        {/* 頂部：會議資訊 */}
        <section className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-xl overflow-hidden relative">
          <div className="bg-[#e07a5f] border-b-4 border-[#5b755e] p-4 text-xl font-bold text-white tracking-wider flex items-center gap-2 drop-shadow-sm">
            <span>⏰</span> <ScrumTooltip keyword="Daily Scrum" text="會議守則 (Daily Scrum)" />
          </div>
          <div className="p-6 flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-1 bg-[#f2e3c6] border-2 border-[#d4a373] p-4 rounded-xl shadow-inner text-[#8b5a2b] font-bold flex items-center gap-3">
              <span className="text-3xl">🎯</span> 
              <div>
                <div className="text-lg">目的：檢視計畫朝向目標、調整計畫</div>
                <div className="text-sm font-medium text-[#6b5e50] mt-1">同步進度、發掘阻礙、確保團隊走在正軌上。</div>
              </div>
            </div>
            <div className="bg-[#fceded] border-2 border-[#e6b1b1] p-4 rounded-xl shadow-inner text-[#c96262] font-bold flex items-center gap-3 md:w-64 justify-center">
              <span className="text-3xl">⏳</span>
              <div className="text-lg">限時 15 分鐘</div>
            </div>
          </div>
        </section>

        {/* 倒數計時器 */}
        <CountdownTimer defaultMinutes={15} />

        {/* 站會任務看板 */}
        <section className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-xl overflow-hidden">
          <div
            className="bg-[#5b755e] border-b-4 border-[#3e5240] p-4 text-xl font-bold text-white tracking-wider flex items-center justify-between cursor-pointer select-none"
            onClick={() => setTaskBoardExpanded(v => !v)}
          >
            <div className="flex items-center gap-2">
              <span>📋</span> 站會任務看板
              <span className="text-sm font-normal opacity-80 ml-2">點擊狀態可切換</span>
            </div>
            <div className="flex items-center gap-3">
              {/* 刷新 */}
              <button
                onClick={e => { e.stopPropagation(); loadBacklogTasks(); }}
                className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors font-normal"
                title="重新載入"
              >🔄</button>
              {/* 分組切換 */}
              <div className="flex text-sm font-normal rounded-lg overflow-hidden border border-white/30" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setTaskGroupBy('person')}
                  className={`px-3 py-1 transition-colors ${taskGroupBy === 'person' ? 'bg-white text-[#5b755e]' : 'bg-white/10 hover:bg-white/20'}`}
                >👤 人員</button>
                <button
                  onClick={() => setTaskGroupBy('status')}
                  className={`px-3 py-1 transition-colors ${taskGroupBy === 'status' ? 'bg-white text-[#5b755e]' : 'bg-white/10 hover:bg-white/20'}`}
                >📊 狀態</button>
              </div>
              <span className="text-sm">{taskBoardExpanded ? '▲' : '▼'}</span>
            </div>
          </div>

          {taskBoardExpanded && (
            <div className="p-4">
              {loadingTasks ? (
                <div className="text-center py-8 text-[#8a7f72] animate-pulse font-bold">載入任務中…</div>
              ) : backlogTasks.length === 0 ? (
                <div className="text-center py-8 text-[#b5a695] italic">此 Sprint 尚無任務，請先在 Sprint Backlog 新增任務。</div>
              ) : taskGroupBy === 'person' ? (
                /* ── 人員分組 ── */
                <div className="space-y-4">
                  {tasksByPerson.map(([name, tasks]) => {
                    const doneCount = tasks.filter(t => t.status === 'done' || t.status === 'accepted').length;
                    const doingCount = tasks.filter(t => t.status === 'doing').length;
                    return (
                      <div key={name} className="border-2 border-[#e8d5b5] rounded-2xl overflow-hidden">
                        <div className="bg-[#f4f1ea] px-4 py-2 flex items-center gap-3 border-b border-[#e8d5b5]">
                          <div className="w-8 h-8 rounded-full bg-[#5b755e] text-white flex items-center justify-center text-sm font-bold shrink-0">
                            {name[0]}
                          </div>
                          <span className="font-bold text-[#3e362e]">{name}</span>
                          <div className="ml-auto flex gap-2 text-xs">
                            {doingCount > 0 && <span className="bg-[#faebce] text-[#8b5a2b] border border-[#d4a373] px-2 py-0.5 rounded-full font-bold">進行中 {doingCount}</span>}
                            <span className="bg-[#e8eedd] text-[#4a7c59] border border-[#8fb996] px-2 py-0.5 rounded-full font-bold">完成 {doneCount}/{tasks.length}</span>
                          </div>
                        </div>
                        <div className="divide-y divide-[#f4f1ea]">
                          {tasks.map(task => {
                            const badge = statusBadge(task.status);
                            const canCycle = task.status !== 'accepted';
                            return (
                              <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#faf8f5] transition-colors">
                                <button
                                  onClick={() => canCycle && cycleStatus(task.id)}
                                  disabled={!canCycle}
                                  title={canCycle ? '點擊切換狀態' : '已驗收，無法修改'}
                                  className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 transition-all ${badge.cls} ${canCycle ? 'hover:opacity-80 cursor-pointer active:scale-95' : 'cursor-default opacity-70'}`}
                                >
                                  {badge.label}
                                </button>
                                <span className="flex-1 text-sm text-[#3e362e] truncate">{task.title}</span>
                                {task.time && <span className="text-xs text-[#8a7f72] shrink-0 bg-[#f4f1ea] px-2 py-0.5 rounded border border-[#e8d5b5]">{task.time}</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ── 狀態分組 ── */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {tasksByStatus.map(col => (
                    <div key={col.key} className="border-2 border-[#e8d5b5] rounded-2xl overflow-hidden">
                      <div className={`px-4 py-2 font-bold text-sm border-b border-[#e8d5b5] flex items-center justify-between ${col.color}`}>
                        <span>{col.label}</span>
                        <span className="text-xs opacity-80">{col.tasks.length} 項</span>
                      </div>
                      <div className="divide-y divide-[#f4f1ea] bg-[#fffdf9]">
                        {col.tasks.length === 0 && (
                          <div className="text-xs text-[#d3cbbd] italic text-center py-4">無</div>
                        )}
                        {col.tasks.map(task => {
                          const canCycle = task.status !== 'accepted';
                          return (
                            <div
                              key={task.id}
                              onClick={() => canCycle && cycleStatus(task.id)}
                              title={canCycle ? '點擊切換狀態' : '已驗收'}
                              className={`px-3 py-2.5 text-sm transition-colors ${canCycle ? 'cursor-pointer hover:bg-[#f4f1ea] active:bg-[#ece8df]' : 'cursor-default'}`}
                            >
                              <div className="font-medium text-[#3e362e] truncate">{task.title}</div>
                              <div className="flex items-center gap-2 mt-1">
                                {task.role && <span className="text-[10px] text-[#8a7f72]">👤 {task.role}</span>}
                                {task.time && <span className="text-[10px] text-[#8a7f72]">⏱ {task.time}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* 動態天數打卡追蹤 */}
        <section className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-[#8fb996] border-b-4 border-[#5b755e] p-4 text-xl font-bold text-white tracking-wider flex items-center justify-between gap-2 drop-shadow-sm flex-wrap">
            <div className="flex items-center gap-2">
              <span>📅</span> {sprintDays} 天進度追蹤 (D1 - D{sprintDays})
            </div>
            {(() => {
              if (!sprintStartDate) return null;
              const today = new Date(); today.setHours(0,0,0,0);
              const start = new Date(sprintStartDate); start.setHours(0,0,0,0);
              const elapsed = Math.floor((today.getTime() - start.getTime()) / 86400000) + 1;
              const total = Number(sprintDays) || 0;
              const remaining = Math.max(0, total - elapsed);
              const isOverdue = elapsed > total;
              return (
                <div className={`text-sm font-bold px-4 py-1.5 rounded-xl border-2 whitespace-nowrap ${
                  isOverdue ? 'bg-[#c96262]/90 border-white/40 text-white'
                  : remaining <= 3 ? 'bg-[#f0c060]/90 border-white/40 text-[#3e362e]'
                  : 'bg-white/25 border-white/40 text-white'
                }`}>
                  {isOverdue
                    ? `⚠️ 已超出 ${elapsed - total} 天`
                    : `第 ${Math.min(elapsed, total)} 天｜還剩 ${remaining} 天`}
                </div>
              );
            })()}
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {Array.from({ length: sprintDays }).map((_, i) => {
                const isChecked = completedDays[i];
                const dow = getDayOfWeek(i);
                const isWeekend = dow === '週六' || dow === '週日';
                const holiday = getHoliday(i);
                return (

                  <div key={i} className={`transition-all duration-300 ${activeDay === i ? 'col-span-full' : ''}`}>
                  <div
                    onClick={() => toggleDay(i)}
                    className={`border-4 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group relative overflow-hidden min-h-[120px]
                      ${isChecked
                        ? holiday ? 'bg-[#d4a373] border-[#b5845a] shadow-md' : isWeekend ? 'bg-[#c9637a] border-[#a04060] shadow-md' : 'bg-[#8fb996] border-[#5b755e] shadow-md'
                        : holiday ? 'bg-[#fdf3e0] border-[#e8c98a] hover:bg-[#fbe9c0] hover:-translate-y-1 hover:shadow-md' : isWeekend ? 'bg-[#f5d0d8] border-[#e8a0b0] hover:bg-[#f0bbc8] hover:-translate-y-1 hover:shadow-md' : 'bg-[#e8eedd] border-[#a5c2a8] hover:bg-[#dcedc1] hover:-translate-y-1 hover:shadow-md'
                      }
                      ${activeDay === i ? 'ring-4 ring-[#e07a5f] scale-[1.02]' : ''}
                      `}
                  >
                    <div
                      className={`absolute top-3 right-3 flex items-center justify-center w-6 h-6 rounded border-2 z-20 cursor-pointer ${isChecked ? 'bg-white border-white text-[#5b755e]' : holiday ? 'border-[#d4a373] bg-white hover:border-[#b5845a]' : isWeekend ? 'border-[#c9637a] bg-white hover:border-[#a04060]' : 'border-[#8a7f72] bg-white hover:border-[#5b755e]'}`}
                      onClick={(e) => toggleCheck(e, i)}
                      title="標記這天為已完成"
                    >
                      {isChecked && '✓'}
                    </div>
                    <div className={`font-bold text-lg z-10 transition-transform ${isChecked ? 'text-white' : holiday ? 'text-[#8b5a2b] group-hover:scale-110' : isWeekend ? 'text-[#a04060] group-hover:scale-110' : 'text-[#4a7c59] group-hover:scale-110'}`}>
                      Day {i + 1}
                    </div>
                    {getDayDate(i) && (
                      <div className={`text-xs font-semibold z-10 mt-0.5 ${isChecked ? 'text-white/80' : holiday ? 'text-[#b5845a]' : isWeekend ? 'text-[#c9637a]' : 'text-[#7a9e7e]'}`}>
                        {getDayDate(i)}
                      </div>
                    )}
                    {getDayOfWeek(i) && (
                      <div className={`text-xs z-10 mt-0.5 ${isChecked ? 'text-white/70' : holiday ? 'text-[#b5845a]' : isWeekend ? 'text-[#c9637a]' : 'text-[#9db89f]'}`}>
                        {getDayOfWeek(i)}
                      </div>
                    )}
                    {holiday && (
                      <div className={`text-[10px] font-bold z-10 mt-1 px-1.5 py-0.5 rounded-full max-w-full truncate ${isChecked ? 'bg-white/25 text-white' : 'bg-[#e8c98a] text-[#7a4f1a]'}`} title={holiday.name}>
                        🎌 {holiday.name}
                      </div>
                    )}
                    <div className={`text-3xl mt-2 z-10 transition-all ${isChecked ? 'opacity-100 scale-125' : 'opacity-50 group-hover:opacity-100'}`}>
                      {isChecked ? '✅' : holiday ? '🎌' : '🌱'}
                    </div>
                    
                    {/* 點擊時的波紋效果背景 */}
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                    
                    {/* 打勾狀態的裝飾 */}
                    {isChecked && (
                      <div className="absolute -top-2 -right-2 text-2xl opacity-30 animate-pulse">
                        ✨
                      </div>
                    )}
                  </div>
                  
                  {/* 展開的筆記區塊 */}
                  {activeDay === i && (
                    <div className="mt-4 bg-[#f9fcf8] border-4 border-[#8fb996] rounded-2xl p-6 shadow-lg relative ml-2 mr-2">
                      <h3 className="text-[#5b755e] font-bold text-xl mb-4 flex items-center gap-2 flex-wrap">
                        <span>📝</span> Day {i + 1}{getDayDate(i) ? ` (${getDayDate(i)} ${getDayOfWeek(i)})` : ''} 執行事項與阻礙紀錄
                        {holiday && <span className="text-sm font-bold bg-[#fbe9c0] text-[#7a4f1a] border border-[#e8c98a] px-2 py-0.5 rounded-full">🎌 {holiday.name}</span>}
                      </h3>
                      <div className="flex flex-col gap-5">
                        {/* 舊版單一文字紀錄（保留顯示） */}
                        {dailyNotes[i] && !dailyNotesQ1[i] && !dailyNotesQ2[i] && !dailyNotesQ3[i] && (
                          <div className="bg-[#fffdf9] p-3 border-2 border-dashed border-[#d4a373] rounded-lg text-sm text-[#8b5a2b] whitespace-pre-wrap">
                            <strong>舊版紀錄保留：</strong>{'\n'}{dailyNotes[i]}
                          </div>
                        )}

                        {/* 前一天唯讀紀錄 */}
                        {i > 0 && (
                          <div className="bg-[#f4f1ea] border-2 border-dashed border-[#c9b99a] rounded-xl p-4">
                            <button
                              onClick={() => togglePrevDay(i)}
                              className="w-full text-xs font-bold text-[#8a7f72] flex items-center gap-1.5 hover:text-[#6b5e50] transition-colors"
                            >
                              <span>📖</span>
                              <span>Day {i}（前一天）紀錄參考</span>
                              <span className="ml-auto text-[#b5a695] font-normal">{collapsedPrevDays.has(i) ? '▶ 展開' : '▼ 收合'}</span>
                            </button>
                            {!collapsedPrevDays.has(i) && (
                              <div className="mt-3">
                                {([
                                  { key: 'Q1' as const, label: '昨天完成了什麼？', notes: dailyNotesQ1 },
                                  { key: 'Q2' as const, label: '今天預計要做什麼？', notes: dailyNotesQ2 },
                                  { key: 'Q3' as const, label: '遇到的阻礙？', notes: dailyNotesQ3 },
                                ]).map(q => {
                                  const prevNotes = (q.notes as Record<number, unknown>)[i - 1];
                                  if (!prevNotes) return null;
                                  const isObj = typeof prevNotes === 'object';
                                  const lines: { name: string; text: string }[] = isObj
                                    ? devNames.map(n => ({ name: n, text: (prevNotes as Record<string, string>)[n] || '' })).filter(l => l.text)
                                    : typeof prevNotes === 'string' && prevNotes ? [{ name: '', text: prevNotes as string }] : [];
                                  if (lines.length === 0) return null;
                                  return (
                                    <div key={q.key} className="mb-2 last:mb-0">
                                      <div className="text-[10px] font-bold text-[#b5a695] mb-1">{q.label}</div>
                                      <div className="space-y-1">
                                        {lines.map(l => (
                                          <div key={l.name} className="flex items-start gap-2">
                                            {l.name && (
                                              <div className="w-5 h-5 rounded-full bg-[#b5a695] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                                                {l.name.charAt(0)}
                                              </div>
                                            )}
                                            <div className="text-xs text-[#6b5e50] bg-white/70 px-2 py-1 rounded-lg flex-1 whitespace-pre-wrap">{l.text}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 三個問題 */}
                        {([
                          { key: 'Q1' as const, icon: '🔄', label: '1. 昨天完成了什麼？', borderCls: 'border-[#a5c2a8]', ringCls: 'focus:ring-[#8fb996]/50', labelCls: 'text-[#5b755e]', ph: (n: string) => `${n}昨日進展...` },
                          { key: 'Q2' as const, icon: '🎯', label: '2. 今天預計要做什麼？', borderCls: 'border-[#a5c2a8]', ringCls: 'focus:ring-[#8fb996]/50', labelCls: 'text-[#5b755e]', ph: (n: string) => `${n}今日目標...` },
                          { key: 'Q3' as const, icon: '🚧', label: '3. 目前有沒有遇到任何阻礙？', borderCls: 'border-[#e6b1b1]', ringCls: 'focus:ring-[#e6b1b1]/50', labelCls: 'text-[#c96262]', ph: (n: string) => `${n}...` },
                        ]).map(q => {
                          const notes = q.key === 'Q1' ? dailyNotesQ1 : q.key === 'Q2' ? dailyNotesQ2 : dailyNotesQ3;
                          // 檢查是否為舊版 string 格式
                          const legacyStr = typeof (notes as Record<number, unknown>)[i] === 'string' ? (notes[i] as unknown as string) : '';
                          return (
                            <div key={q.key} className="flex flex-col gap-2">
                              <label className={`font-bold flex items-center gap-2 ${q.labelCls}`}>
                                <span>{q.icon}</span> {q.label}
                              </label>
                              {/* 舊版格式顯示 */}
                              {legacyStr && (
                                <div className="text-xs text-[#8a7f72] bg-[#f4f1ea] px-3 py-2 rounded-lg whitespace-pre-wrap border border-[#e8d5b5]">
                                  {legacyStr}
                                </div>
                              )}
                              {devNames.length > 0 ? (
                                /* 有開發人員名單：逐人一行 */
                                <div className="space-y-2">
                                  {devNames.map(name => (
                                    <div key={name} className="flex items-start gap-2">
                                      <div className="flex items-center gap-1.5 w-20 shrink-0 pt-2.5">
                                        <div className="w-6 h-6 rounded-full bg-[#5b755e] text-white flex items-center justify-center text-xs font-bold shrink-0">
                                          {name.charAt(0)}
                                        </div>
                                        <span className="text-xs font-bold text-[#3e362e] truncate">{name}</span>
                                      </div>
                                      <AutoGrowTextarea
                                        value={getPersonNote(notes, i, name)}
                                        onChange={e => updatePersonNote(i, q.key, name, e.target.value)}
                                        placeholder={q.ph(name)}
                                        rows={2}
                                        className={`flex-1 p-2.5 border-2 ${q.borderCls} rounded-xl focus:outline-none focus:ring-4 ${q.ringCls} bg-white text-[#3e362e] resize-none overflow-hidden shadow-inner text-sm`}
                                      />
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                /* 無開發人員名單：單一文字區 */
                                <AutoGrowTextarea
                                  value={legacyStr || (typeof (notes as Record<number, unknown>)[i] === 'object' ? '' : '')}
                                  onChange={e => updateSpecificNote(i, q.key, e.target.value)}
                                  placeholder={q.ph('')}
                                  rows={2}
                                  className={`w-full p-3 border-2 ${q.borderCls} rounded-xl focus:outline-none focus:ring-4 ${q.ringCls} bg-white text-[#3e362e] resize-none overflow-hidden shadow-inner`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between items-center mt-4">
                        <button
                          onClick={() => { handleSaveDay(i); toggleDay(i); }}
                          className="bg-[#5b755e] text-white border-2 border-[#3e5240] px-6 py-2 rounded-xl font-bold hover:bg-[#4a6b50] transition-all shadow-sm flex items-center gap-2"
                        >
                          ✅ 儲存並完成
                        </button>
                        <button
                          onClick={() => toggleDay(i)}
                          className="bg-[#e8eedd] text-[#5b755e] border-2 border-[#8fb996] px-6 py-2 rounded-xl font-bold hover:bg-[#dcedc1] transition-all shadow-sm"
                        >
                          收起紀錄
                        </button>
                      </div>
                    </div>
                  )}
                  </div>

                );
              })}
            </div>
          </div>
        </section>

        <div className="flex justify-end pt-4">
          <Link href="/review" className="bg-[#e07a5f] text-white px-8 py-3 rounded-full font-bold text-lg hover:bg-[#c66147] hover:-translate-y-1 transition-all duration-200 shadow-lg border-2 border-[#8a4231] inline-flex items-center gap-2">
            <span>🚂</span> 前往 Sprint Review (檢視會議)
          </Link>
        </div>
        
      </div>
    </main>
  );
}
