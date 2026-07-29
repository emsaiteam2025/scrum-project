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
import {
  Clock, Target, AlertTriangle, ClipboardList, CalendarDays,
  User, Users, BarChart2, RefreshCw, ChevronDown,
  CheckCircle2, Flag, Camera, ArrowRight, BookOpen, FileText, Trash2,
} from 'lucide-react';

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

const AV_PAL = ['#C96442', '#4F7E5C', '#B8893A', '#467386', '#8B5A2B', '#5A574E'];
const avColor = (name: string): string => {
  let h = 0;
  for (let ci = 0; ci < name.length; ci++) h += name.charCodeAt(ci);
  return AV_PAL[h % AV_PAL.length];
};

const qIconEl = (key: 'Q1' | 'Q2' | 'Q3') => {
  if (key === 'Q1') return <CheckCircle2 size={14} strokeWidth={1.75} className="text-[#4F7E5C] flex-shrink-0" />;
  if (key === 'Q2') return <Target size={14} strokeWidth={1.75} className="text-[#C96442] flex-shrink-0" />;
  return <AlertTriangle size={14} strokeWidth={1.75} className="text-[#B8543C] flex-shrink-0" />;
};

export default function DailyScrum() {
  const [sprintDays, setSprintDays] = useState<number>(30);

  const { data, updateData, loading, saveStatus, forceSave } = useAutoSave('daily', {
    completedDays: [] as boolean[],
    dailyNotes: {} as Record<number, string>,
    dailyNotesQ1: {} as Record<number, string>,
    dailyNotesQ2: {} as Record<number, string>,
    dailyNotesQ3: {} as Record<number, string>,
    leaveStatus: {} as Record<number, string[]>
  });

  const dailyNotes = data.dailyNotes || {};
  const dailyNotesQ1 = data.dailyNotesQ1 || {};
  const dailyNotesQ2 = data.dailyNotesQ2 || {};
  const dailyNotesQ3 = data.dailyNotesQ3 || {};
  const leaveStatus: Record<number, string[]> = (data as Record<string, unknown>).leaveStatus as Record<number, string[]> || {};
  const isOnLeave = (dayIdx: number, name: string) => (leaveStatus[dayIdx] || []).includes(name);
  const toggleLeave = (dayIdx: number, name: string) => {
    const current = leaveStatus[dayIdx] || [];
    const next = current.includes(name) ? current.filter((n: string) => n !== name) : [...current, name];
    updateData({ leaveStatus: { ...leaveStatus, [dayIdx]: next } });
  };
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [collapsedPrevDays, setCollapsedPrevDays] = useState<Set<number>>(new Set());
  const togglePrevDay = (day: number) => setCollapsedPrevDays(prev => {
    const next = new Set(prev);
    if (next.has(day)) { next.delete(day); } else { next.add(day); }
    return next;
  });

  const [sprintStartDate, setSprintStartDate] = useState<string>('');
  const [sprintName, setSprintName] = useState<string>('');
  const [devNames, setDevNames] = useState<string[]>([]);
  const [backlogTasks, setBacklogTasks] = useState<BacklogTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskBoardExpanded, setTaskBoardExpanded] = useState(true);
  const [taskGroupBy, setTaskGroupBy] = useState<'person' | 'status'>('status');
  const [holidays, setHolidays] = useState<{ id: string; date: string; name: string }[]>([]);
  const [imagePreviewDay, setImagePreviewDay] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const imageCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedDays = localStorage.getItem('sprintDays');
    setSprintDays(savedDays ? Number(savedDays) : 30);
    const name = localStorage.getItem('currentSprintName');
    if (name) setSprintName(name);
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

  const holidayDateSet = new Set(holidays.map(h => h.date));
  const countWorkDays = (from: Date, to: Date): number => {
    let count = 0;
    const cur = new Date(from);
    while (cur <= to) {
      const d = cur.getDay();
      const iso = cur.toISOString().slice(0, 10);
      if (d !== 0 && d !== 6 && !holidayDateSet.has(iso)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

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

  const completedDays: boolean[] = (() => {
    const stored = data.completedDays || [];
    const result = Array(sprintDays).fill(false);
    for (let i = 0; i < Math.min(stored.length, sprintDays); i++) {
      result[i] = !!stored[i];
    }
    return result;
  })();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getPersonNote = (notes: Record<number, string>, dayIdx: number, person: string): string => {
    const v = (notes as Record<number, unknown>)[dayIdx];
    if (!v || typeof v === 'string') return '';
    return (v as Record<string, string>)[person] || '';
  };

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

  const downloadDayImage = async (dayIdx: number) => {
    const el = imageCardRef.current;
    if (!el) return;
    setIsGenerating(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#fffdf9', useCORS: true, logging: false });
      const link = document.createElement('a');
      link.download = `Day${dayIdx + 1}_站會紀錄_${getDayDate(dayIdx) || ''}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) { console.error(e); }
    setIsGenerating(false);
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

  // 清空某一天的所有資料：三問紀錄、舊版紀錄、請假名單，並取消完成勾
  const clearDay = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const dayNum = index + 1;
    if (!window.confirm(`確定清空 Day ${dayNum} 的所有資料嗎？此動作無法復原。`)) return;
    // 注意：不能用 delete 移除鍵。Firestore setDoc(merge:true) 會逐鍵合併巢狀 map，
    // 「不存在的鍵」不會送上雲端，舊值原封不動留著，onSnapshot 回傳後又被塞回畫面。
    // 因此改成明確寫入空值覆蓋，清除才會真的生效。
    const blank = <V,>(m: Record<number, unknown>, empty: V) => ({ ...(m || {}), [index]: empty });
    const stored = data.completedDays || [];
    const merged = stored.length >= sprintDays
      ? [...stored]
      : [...stored, ...Array(sprintDays - stored.length).fill(false)];
    merged[index] = false;
    updateData({
      dailyNotes: blank(dailyNotes, '') as Record<number, string>,
      dailyNotesQ1: blank(dailyNotesQ1, '') as Record<number, string>,
      dailyNotesQ2: blank(dailyNotesQ2, '') as Record<number, string>,
      dailyNotesQ3: blank(dailyNotesQ3, '') as Record<number, string>,
      leaveStatus: blank(leaveStatus, [] as string[]) as Record<number, string[]>,
      completedDays: merged,
    });
    setTimeout(() => forceSave(), 100);
  };

  const toggleCheck = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const stored = data.completedDays || [];
    const merged = stored.length >= sprintDays
      ? [...stored]
      : [...stored, ...Array(sprintDays - stored.length).fill(false)];
    merged[index] = !merged[index];
    updateData({ completedDays: merged });
  };

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

  const cycleStatus = async (taskId: string) => {
    const sprintId = localStorage.getItem('currentSprintId');
    if (!sprintId) return;
    const cycle: Record<string, BacklogTask['status']> = { todo: 'doing', doing: 'done', done: 'todo' };
    const task = backlogTasks.find(t => t.id === taskId);
    if (!task || task.status === 'accepted' || task.status === 'pbi') return;
    const next = cycle[task.status] ?? 'todo';
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
      setBacklogTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
    }
  };

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

  const tasksByStatus = [
    { key: 'todo', label: '待辦', dotColor: '#B8543C', tasks: backlogTasks.filter(t => t.status === 'todo') },
    { key: 'doing', label: '進行中', dotColor: '#B8893A', tasks: backlogTasks.filter(t => t.status === 'doing') },
    { key: 'done', label: '完成', dotColor: '#4F7E5C', tasks: backlogTasks.filter(t => t.status === 'done' || t.status === 'accepted') },
  ];

  const statusBadge = (status: string) => {
    if (status === 'done' || status === 'accepted') return { label: status === 'accepted' ? '驗收' : '完成', cls: 'bg-[#DDE6D9] text-[#4F7E5C]' };
    if (status === 'doing') return { label: '進行中', cls: 'bg-[#F5E4DA] text-[#7A3520]' };
    return { label: '待辦', cls: 'bg-[#F6F3EB] text-[#8B887E]' };
  };

  return (
    <main className="min-h-screen bg-[#FAF9F5] p-4 md:p-8 font-sans text-[#1F1D17]">
      <div className="w-full space-y-6">

        <div className="flex flex-col items-center">
          <Navigation />
          <SaveIndicator status={saveStatus} />
        </div>

        {loading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
            <div className="bg-white px-6 py-4 rounded-xl border border-[#E9E5DA] text-[#5A574E] shadow-xl text-sm flex items-center gap-3">
              <Clock size={15} strokeWidth={1.75} className="text-[#8B887E]" />
              <span>載入資料中...</span>
            </div>
          </div>
        )}

        {/* 會議守則 */}
        <section className="bg-white border border-[#E9E5DA] rounded-xl overflow-hidden">
          <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-5 py-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#C96442] flex items-center justify-center flex-shrink-0">
              <Clock size={13} strokeWidth={2} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-[#1F1D17]">
              <ScrumTooltip keyword="Daily Scrum" text="會議守則 (Daily Scrum)" />
            </span>
          </div>
          <div className="p-5 flex flex-col md:flex-row gap-4 items-stretch">
            {/* 目的說明：左側 3px 色條 */}
            <div className="flex-1 border border-[#E9E5DA] border-l-[3px] border-l-[#C96442] rounded-xl p-4 bg-white flex items-center gap-3">
              <Target size={20} strokeWidth={1.75} className="text-[#C96442] flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-[#1F1D17]">目的：檢視計畫朝向目標、調整計畫</div>
                <div className="text-xs text-[#5A574E] mt-0.5">同步進度、發掘阻礙、確保團隊走在正軌上。</div>
              </div>
            </div>
            {/* 限時 chip */}
            <div className="inline-flex items-center gap-2 self-center bg-[#F5E4DA] text-[#7A3520] text-sm font-semibold px-4 py-2 rounded-lg flex-shrink-0">
              <Clock size={14} strokeWidth={1.75} />
              限時 15 分鐘
            </div>
            {/* 剩餘工作天 */}
            {(() => {
              const total = Number(sprintDays) || 0;
              if (!sprintStartDate) {
                return (
                  <div className="inline-flex items-center gap-2 self-center bg-[#DDE6D9] text-[#4F7E5C] text-sm font-semibold px-4 py-2 rounded-lg flex-shrink-0">
                    <CalendarDays size={14} strokeWidth={1.75} />
                    共 {total} 天 Sprint
                  </div>
                );
              }
              const today = new Date(); today.setHours(0,0,0,0);
              const start = new Date(sprintStartDate); start.setHours(0,0,0,0);
              const sprintEnd = new Date(start); sprintEnd.setDate(sprintEnd.getDate() + total - 1);
              const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
              const elapsed = countWorkDays(start, today);
              const isOverdue = today > sprintEnd;
              const remaining = isOverdue ? 0 : countWorkDays(tomorrow, sprintEnd);
              return (
                <div className={`inline-flex items-center gap-2 self-center text-sm font-semibold px-4 py-2 rounded-lg flex-shrink-0 ${
                  isOverdue ? 'bg-[#F0DDD3] text-[#B8543C]'
                  : remaining <= 3 ? 'bg-[#F0E4C9] text-[#B8893A]'
                  : 'bg-[#DDE6D9] text-[#4F7E5C]'
                }`}>
                  <CalendarDays size={14} strokeWidth={1.75} />
                  {isOverdue
                    ? '已超出 Sprint 期限'
                    : `還剩 ${remaining} 工作天（第 ${elapsed} 天 / 共 ${total} 天）`
                  }
                </div>
              );
            })()}
          </div>
        </section>

        {/* 倒數計時器 */}
        <CountdownTimer defaultMinutes={15} />

        {/* 站會任務看板 */}
        <section className="bg-white border border-[#E9E5DA] rounded-xl overflow-hidden">
          <div
            className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-5 py-3 flex items-center justify-between cursor-pointer select-none"
            onClick={() => setTaskBoardExpanded(v => !v)}
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#5A574E] flex items-center justify-center flex-shrink-0">
                <ClipboardList size={13} strokeWidth={2} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-[#1F1D17]">站會任務看板</span>
              <span className="text-xs text-[#8B887E]">點擊狀態可切換</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={e => { e.stopPropagation(); loadBacklogTasks(); }}
                className="text-[#8B887E] hover:text-[#1F1D17] hover:bg-[#F1EEE6] p-1.5 rounded-md transition-all"
                title="重新載入"
              >
                <RefreshCw size={13} strokeWidth={1.75} />
              </button>
              {/* Segmented control */}
              <div className="flex p-0.5 bg-[#E9E5DA] rounded-lg gap-0.5" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setTaskGroupBy('person')}
                  className={`inline-flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-all ${
                    taskGroupBy === 'person' ? 'bg-white font-semibold text-[#1F1D17] shadow-sm' : 'text-[#8B887E] hover:text-[#5A574E]'
                  }`}
                >
                  <User size={11} strokeWidth={1.75} /> 人員
                </button>
                <button
                  onClick={() => setTaskGroupBy('status')}
                  className={`inline-flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-all ${
                    taskGroupBy === 'status' ? 'bg-white font-semibold text-[#1F1D17] shadow-sm' : 'text-[#8B887E] hover:text-[#5A574E]'
                  }`}
                >
                  <BarChart2 size={11} strokeWidth={1.75} /> 狀態
                </button>
              </div>
              <ChevronDown size={14} strokeWidth={1.75} className={`text-[#8B887E] transition-transform ${taskBoardExpanded ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {taskBoardExpanded && (
            <div className="p-4">
              {loadingTasks ? (
                <div className="text-center py-8 text-[#8B887E] text-sm animate-pulse">載入任務中…</div>
              ) : backlogTasks.length === 0 ? (
                <div className="text-center py-8 text-[#B5B2A6] text-sm italic">此 Sprint 尚無任務，請先在 Sprint Backlog 新增任務。</div>
              ) : taskGroupBy === 'person' ? (
                /* 人員分組 */
                <div className="space-y-3">
                  {tasksByPerson.map(([name, tasks]) => {
                    const doneCount = tasks.filter(t => t.status === 'done' || t.status === 'accepted').length;
                    const doingCount = tasks.filter(t => t.status === 'doing').length;
                    return (
                      <div key={name} className="border border-[#E9E5DA] rounded-xl overflow-hidden">
                        <div className="bg-[#F6F3EB] px-4 py-2.5 flex items-center gap-3 border-b border-[#E9E5DA]">
                          <div
                            className="w-8 h-8 rounded-full text-white flex items-center justify-center text-sm font-semibold shrink-0"
                            style={{ backgroundColor: avColor(name) }}
                          >
                            {name[0]}
                          </div>
                          <span className="font-semibold text-sm text-[#1F1D17]">{name}</span>
                          <div className="ml-auto flex gap-1.5 text-xs">
                            {doingCount > 0 && (
                              <span className="bg-[#F5E4DA] text-[#7A3520] px-2 py-0.5 rounded-full font-medium">進行中 {doingCount}</span>
                            )}
                            <span className="bg-[#DDE6D9] text-[#4F7E5C] px-2 py-0.5 rounded-full font-medium">完成 {doneCount}/{tasks.length}</span>
                          </div>
                        </div>
                        <div className="divide-y divide-[#F6F3EB] bg-white">
                          {tasks.map(task => {
                            const badge = statusBadge(task.status);
                            const canCycle = task.status !== 'accepted';
                            return (
                              <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#FAF9F5] transition-colors">
                                <button
                                  onClick={() => canCycle && cycleStatus(task.id)}
                                  disabled={!canCycle}
                                  title={canCycle ? '點擊切換狀態' : '已驗收，無法修改'}
                                  className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 transition-all ${badge.cls} ${canCycle ? 'hover:opacity-80 cursor-pointer active:scale-95' : 'cursor-default opacity-70'}`}
                                >
                                  {badge.label}
                                </button>
                                <span className="flex-1 text-sm text-[#1F1D17] truncate">{task.title}</span>
                                {task.time && (
                                  <span className="text-xs text-[#8B887E] shrink-0 bg-[#F6F3EB] px-2 py-0.5 rounded border border-[#E9E5DA]">{task.time}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* 狀態分組 */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {tasksByStatus.map(col => (
                    <div key={col.key} className="border border-[#E9E5DA] rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 bg-white border-b border-[#E9E5DA] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col.dotColor }} />
                          <span className="text-xs font-semibold text-[#5A574E]">{col.label}</span>
                        </div>
                        <span className="text-xs text-[#8B887E]">{col.tasks.length} 項</span>
                      </div>
                      <div className="divide-y divide-[#F6F3EB] bg-white">
                        {col.tasks.length === 0 && (
                          <div className="text-xs text-[#B5B2A6] italic text-center py-4">無</div>
                        )}
                        {col.tasks.map(task => {
                          const canCycle = task.status !== 'accepted';
                          return (
                            <div
                              key={task.id}
                              onClick={() => canCycle && cycleStatus(task.id)}
                              title={canCycle ? '點擊切換狀態' : '已驗收'}
                              className={`px-3 py-2.5 text-sm transition-colors ${canCycle ? 'cursor-pointer hover:bg-[#FAF9F5] active:bg-[#F6F3EB]' : 'cursor-default'}`}
                            >
                              <div className="font-medium text-[#1F1D17] truncate">{task.title}</div>
                              <div className="flex items-center gap-2 mt-1">
                                {task.role && <span className="text-[10px] text-[#8B887E]">{task.role}</span>}
                                {task.time && <span className="text-[10px] text-[#B5B2A6]">{task.time}</span>}
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
        <section className="bg-white border border-[#E9E5DA] rounded-xl overflow-hidden">
          <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-5 py-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#4F7E5C] flex items-center justify-center flex-shrink-0">
                <CalendarDays size={13} strokeWidth={2} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-[#1F1D17]">{sprintDays} 天進度追蹤 (D1 – D{sprintDays})</span>
            </div>
            {(() => {
              if (!sprintStartDate) return null;
              const today = new Date(); today.setHours(0,0,0,0);
              const start = new Date(sprintStartDate); start.setHours(0,0,0,0);
              const total = Number(sprintDays) || 0;
              const sprintEnd = new Date(start); sprintEnd.setDate(sprintEnd.getDate() + total - 1);
              const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
              const elapsed = countWorkDays(start, today);
              const isOverdue = today > sprintEnd;
              const remaining = isOverdue ? 0 : countWorkDays(tomorrow, sprintEnd);
              return (
                <span className={`text-xs font-semibold px-3 py-1 rounded-lg ${
                  isOverdue ? 'bg-[#F0DDD3] text-[#B8543C]'
                  : remaining <= 3 ? 'bg-[#F0E4C9] text-[#B8893A]'
                  : 'bg-[#DDE6D9] text-[#4F7E5C]'
                }`}>
                  {isOverdue ? '已超出期限' : `第 ${elapsed} 工作天｜還剩 ${remaining} 工作天`}
                </span>
              );
            })()}
          </div>

          <div className="p-4 md:p-5">
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {Array.from({ length: sprintDays }).map((_, i) => {
                const isChecked = completedDays[i];
                const dow = getDayOfWeek(i);
                const isWeekend = dow === '週六' || dow === '週日';
                const holiday = getHoliday(i);

                return (
                  <div key={i} className={`transition-all duration-300 ${activeDay === i ? 'col-span-full' : ''}`}>
                    <div
                      onClick={() => toggleDay(i)}
                      className={`border rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group relative overflow-hidden min-h-[110px]
                        ${isChecked
                          ? 'bg-[#DDE6D9] border-[#4F7E5C]'
                          : holiday
                            ? 'bg-[#F0E4C9] border-[#E9E5DA]'
                            : isWeekend
                              ? 'bg-[#F6F3EB] border-[#E9E5DA]'
                              : 'bg-white border-[#E9E5DA]'
                        }
                        ${activeDay === i ? 'ring-1 ring-[#C96442] shadow-md' : 'hover:shadow-sm hover:-translate-y-[1px]'}
                      `}
                    >
                      {/* 狀態小圓點 (左上) */}
                      {!isChecked && (holiday || isWeekend) && (
                        <span
                          className="absolute top-2 left-2 w-2 h-2 rounded-full"
                          style={{ backgroundColor: holiday ? '#B8893A' : '#B5B2A6' }}
                        />
                      )}

                      {/* 打勾方塊 (右上) */}
                      <div
                        className={`absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded z-20 cursor-pointer border transition-all ${
                          isChecked
                            ? 'bg-[#4F7E5C] border-[#4F7E5C]'
                            : 'border-[#D8D3C5] bg-white hover:border-[#8B887E]'
                        }`}
                        style={{ borderWidth: '1.5px' }}
                        onClick={(e) => toggleCheck(e, i)}
                        title="標記這天為已完成"
                      >
                        {isChecked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>

                      {/* 清空這天資料 (hover 顯示) */}
                      <button
                        onClick={(e) => clearDay(e, i)}
                        className="absolute bottom-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-white/90 border border-[#E9E5DA] text-[#8B887E] hover:text-[#B8543C] hover:bg-[#F0DDD3] shadow-sm"
                        title="清空這天資料"
                      >
                        <Trash2 size={12} strokeWidth={1.75} />
                      </button>

                      <div className={`font-bold text-base z-10 mt-2 ${
                        isChecked ? 'text-[#4F7E5C]' : holiday ? 'text-[#B8893A]' : isWeekend ? 'text-[#8B887E]' : 'text-[#1F1D17]'
                      }`}>
                        Day {i + 1}
                      </div>
                      {getDayDate(i) && (
                        <div className={`text-xs z-10 mt-0.5 ${
                          isChecked ? 'text-[#4F7E5C]' : holiday ? 'text-[#B8893A]' : isWeekend ? 'text-[#8B887E]' : 'text-[#5A574E]'
                        }`}>
                          {getDayDate(i)}
                        </div>
                      )}
                      {getDayOfWeek(i) && (
                        <div className={`text-[10px] z-10 mt-0.5 ${
                          isChecked ? 'text-[#4F7E5C]/80' : holiday ? 'text-[#B8893A]/80' : isWeekend ? 'text-[#B5B2A6]' : 'text-[#8B887E]'
                        }`}>
                          {getDayOfWeek(i)}
                        </div>
                      )}
                      {holiday && (
                        <div className={`text-[10px] z-10 mt-1 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 max-w-full truncate ${
                          isChecked ? 'bg-[#4F7E5C]/20 text-[#4F7E5C]' : 'bg-[#F0E4C9] text-[#B8893A]'
                        }`} title={holiday.name}>
                          <Flag size={9} strokeWidth={1.75} />
                          {holiday.name}
                        </div>
                      )}
                      {(leaveStatus[i] || []).length > 0 && (
                        <div className="text-[10px] bg-[#F0E4C9] text-[#B8893A] px-1.5 py-0.5 rounded-md mt-1 z-10">
                          {(leaveStatus[i] || []).length}人請假
                        </div>
                      )}
                    </div>

                    {/* 展開的筆記區塊 */}
                    {activeDay === i && (
                      <div className="mt-3 bg-white border border-[#E9E5DA] rounded-xl p-5 relative">
                        <h3 className="text-[#1F1D17] font-semibold text-base mb-4 flex items-center gap-2 flex-wrap">
                          <FileText size={16} strokeWidth={1.75} className="text-[#8B887E]" />
                          Day {i + 1}{getDayDate(i) ? ` (${getDayDate(i)} ${getDayOfWeek(i)})` : ''} 執行事項與阻礙紀錄
                          {holiday && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium bg-[#F0E4C9] text-[#B8893A] px-2 py-0.5 rounded-lg">
                              <Flag size={10} strokeWidth={1.75} /> {holiday.name}
                            </span>
                          )}
                        </h3>

                        <div className="flex flex-col gap-5">
                          {/* 出席狀況 */}
                          {devNames.length > 0 && (
                            <div className="bg-[#F6F3EB] border border-[#E9E5DA] rounded-xl p-4">
                              <div className="text-xs font-semibold text-[#5A574E] mb-3 flex items-center gap-1.5">
                                <Users size={13} strokeWidth={1.75} className="text-[#8B887E]" />
                                今日出席狀況
                                <span className="font-normal text-[#B5B2A6]">（點擊切換請假/出席）</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {devNames.map(name => {
                                  const onLeave = isOnLeave(i, name);
                                  return (
                                    <button
                                      key={name}
                                      onClick={() => toggleLeave(i, name)}
                                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-medium text-sm transition-all ${
                                        onLeave
                                          ? 'border-[#B8893A] text-[#B8893A] bg-[#F0E4C9] hover:bg-[#E8D5B0]'
                                          : 'border-[#4F7E5C] text-[#4F7E5C] bg-[#DDE6D9] hover:bg-[#C8D9C4]'
                                      }`}
                                    >
                                      <span
                                        className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] text-white font-bold shrink-0"
                                        style={{ backgroundColor: onLeave ? '#B5B2A6' : avColor(name) }}
                                      >
                                        {name.charAt(0)}
                                      </span>
                                      <span>{name}</span>
                                      <span className="text-xs">{onLeave ? '請假' : '出席'}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 舊版單一文字紀錄（保留顯示） */}
                          {dailyNotes[i] && !dailyNotesQ1[i] && !dailyNotesQ2[i] && !dailyNotesQ3[i] && (
                            <div className="bg-[#FAF9F5] p-3 border border-dashed border-[#D8D3C5] rounded-lg text-xs text-[#5A574E] whitespace-pre-wrap">
                              <strong>舊版紀錄保留：</strong>{'\n'}{dailyNotes[i]}
                            </div>
                          )}

                          {/* 前一天唯讀紀錄 */}
                          {(() => {
                            // 判斷某天是否「真的有內容」：空物件 {} 或全空字串的物件不算，
                            // 才能正確跳過沒填的日子，往回找到上一個有資料的工作日。
                            const dayHasContent = (day: number): boolean => {
                              const check = (m: Record<number, unknown>) => {
                                const v = m[day];
                                if (!v) return false;
                                if (typeof v === 'string') return v.trim() !== '';
                                if (typeof v === 'object') return Object.values(v as Record<string, string>).some(t => t && String(t).trim() !== '');
                                return false;
                              };
                              return check(dailyNotesQ1) || check(dailyNotesQ2) || check(dailyNotesQ3) || check(dailyNotes);
                            };
                            let refDay = i - 1;
                            while (refDay >= 0 && !dayHasContent(refDay)) refDay--;
                            if (refDay < 0) return null;
                            return (
                              <div className="bg-[#F6F3EB] border border-dashed border-[#D8D3C5] rounded-xl p-4">
                                <button
                                  onClick={() => togglePrevDay(i)}
                                  className="w-full text-xs font-medium text-[#8B887E] flex items-center gap-1.5 hover:text-[#5A574E] transition-colors"
                                >
                                  <BookOpen size={12} strokeWidth={1.75} />
                                  <span>Day {refDay + 1}（前一個工作日）紀錄參考</span>
                                  <span className="ml-auto text-[#B5B2A6] font-normal">{collapsedPrevDays.has(i) ? '▶ 展開' : '▼ 收合'}</span>
                                </button>
                                {!collapsedPrevDays.has(i) && (
                                  <div className="mt-3">
                                    {([
                                      { key: 'Q1' as const, label: '上一個工作日完成了什麼？', notes: dailyNotesQ1 },
                                      { key: 'Q2' as const, label: '今天預計要做什麼？', notes: dailyNotesQ2 },
                                      { key: 'Q3' as const, label: '遇到的阻礙？', notes: dailyNotesQ3 },
                                    ]).map(q => {
                                      const prevNotes = (q.notes as Record<number, unknown>)[refDay];
                                      if (!prevNotes) return null;
                                      const isObj = typeof prevNotes === 'object';
                                      const lines: { name: string; text: string }[] = isObj
                                        ? devNames.map(n => ({ name: n, text: (prevNotes as Record<string, string>)[n] || '' })).filter(l => l.text)
                                        : typeof prevNotes === 'string' && prevNotes ? [{ name: '', text: prevNotes as string }] : [];
                                      if (lines.length === 0) return null;
                                      return (
                                        <div key={q.key} className="mb-2 last:mb-0">
                                          <div className="text-[10px] font-semibold text-[#B5B2A6] mb-1">{q.label}</div>
                                          <div className="space-y-1">
                                            {lines.map(l => (
                                              <div key={l.name} className="flex items-start gap-2">
                                                {l.name && (
                                                  <div
                                                    className="w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                                                    style={{ backgroundColor: avColor(l.name) }}
                                                  >
                                                    {l.name.charAt(0)}
                                                  </div>
                                                )}
                                                <div className="text-xs text-[#5A574E] bg-white px-2 py-1 rounded-lg flex-1 whitespace-pre-wrap border border-[#E9E5DA]">{l.text}</div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* 三個問題 */}
                          {([
                            { key: 'Q1' as const, label: '1. 上一個工作日完成了什麼？', borderCls: 'border-[#E9E5DA]', labelCls: 'text-[#1F1D17]', ph: (n: string) => `${n}昨日進展...` },
                            { key: 'Q2' as const, label: '2. 今天預計要做什麼？', borderCls: 'border-[#E9E5DA]', labelCls: 'text-[#1F1D17]', ph: (n: string) => `${n}今日目標...` },
                            { key: 'Q3' as const, label: '3. 目前有沒有遇到任何阻礙？', borderCls: 'border-[#F0DDD3]', labelCls: 'text-[#B8543C]', ph: (n: string) => `${n}...` },
                          ]).map(q => {
                            const notes = q.key === 'Q1' ? dailyNotesQ1 : q.key === 'Q2' ? dailyNotesQ2 : dailyNotesQ3;
                            const legacyStr = typeof (notes as Record<number, unknown>)[i] === 'string' ? (notes[i] as unknown as string) : '';
                            return (
                              <div key={q.key} className="flex flex-col gap-2">
                                <label className={`font-semibold text-sm flex items-center gap-1.5 ${q.labelCls}`}>
                                  {qIconEl(q.key)} {q.label}
                                </label>
                                {legacyStr && (
                                  <div className="text-xs text-[#8B887E] bg-[#F6F3EB] px-3 py-2 rounded-lg whitespace-pre-wrap border border-[#E9E5DA]">
                                    {legacyStr}
                                  </div>
                                )}
                                {devNames.length > 0 ? (
                                  <div className="space-y-2">
                                    {devNames.map(name => {
                                      const onLeave = isOnLeave(i, name);
                                      return (
                                        <div key={name} className={`flex items-start gap-2 ${onLeave ? 'opacity-50' : ''}`}>
                                          <div className="flex items-center gap-1.5 w-20 shrink-0 pt-2.5">
                                            <div
                                              className="w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0"
                                              style={{ backgroundColor: onLeave ? '#B5B2A6' : avColor(name) }}
                                            >
                                              {name.charAt(0)}
                                            </div>
                                            <span className="text-xs font-semibold text-[#1F1D17] truncate">{name}</span>
                                          </div>
                                          {onLeave ? (
                                            <div className="flex-1 py-2 px-3 text-xs text-[#B8893A] italic border border-dashed border-[#D8D3C5] rounded-lg bg-[#F0E4C9]">本日請假</div>
                                          ) : (
                                            <AutoGrowTextarea
                                              value={getPersonNote(notes, i, name)}
                                              onChange={e => updatePersonNote(i, q.key, name, e.target.value)}
                                              placeholder={q.ph(name)}
                                              rows={2}
                                              className={`flex-1 p-2.5 border ${q.borderCls} rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] bg-white text-[#1F1D17] resize-none overflow-hidden text-sm`}
                                            />
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <AutoGrowTextarea
                                    value={legacyStr || ''}
                                    onChange={e => updateSpecificNote(i, q.key, e.target.value)}
                                    placeholder={q.ph('')}
                                    rows={2}
                                    className={`w-full p-3 border ${q.borderCls} rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] bg-white text-[#1F1D17] resize-none overflow-hidden text-sm`}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex justify-between items-center mt-5 flex-wrap gap-2">
                          <button
                            onClick={() => { handleSaveDay(i); toggleDay(i); }}
                            className="inline-flex items-center gap-2 bg-[#1F1D17] text-white px-6 py-2 rounded-[9px] font-semibold text-sm hover:bg-[#5A574E] transition-all"
                          >
                            <CheckCircle2 size={14} strokeWidth={1.75} /> 儲存並完成
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setImagePreviewDay(i)}
                              className="inline-flex items-center gap-2 border border-[#E9E5DA] text-[#5A574E] px-4 py-2 rounded-[9px] text-sm hover:bg-[#F6F3EB] transition-colors"
                            >
                              <Camera size={13} strokeWidth={1.75} /> 生成圖片
                            </button>
                            <button
                              onClick={() => toggleDay(i)}
                              className="border border-[#E9E5DA] text-[#5A574E] px-4 py-2 rounded-[9px] text-sm hover:bg-[#F6F3EB] transition-colors"
                            >
                              收起紀錄
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div className="flex justify-end pt-2">
          <Link
            href="/review"
            className="inline-flex items-center gap-2 bg-[#C96442] text-white px-8 py-3 rounded-[9px] font-semibold text-sm hover:bg-[#7A3520] hover:shadow-md hover:-translate-y-[1px] transition-all duration-150"
          >
            前往 Sprint Review (檢視會議) <ArrowRight size={16} strokeWidth={1.75} />
          </Link>
        </div>

      </div>

      {/* 圖片預覽 Modal */}
      {imagePreviewDay !== null && (() => {
        const d = imagePreviewDay;
        const qDefs = [
          { key: 'Q1' as const, icon: '🔄', label: '上一個工作日完成了什麼？', notes: dailyNotesQ1, bg: '#f0f7f1', border: '#8fb996' },
          { key: 'Q2' as const, icon: '🎯', label: '今天預計要做什麼？', notes: dailyNotesQ2, bg: '#f0f7f1', border: '#8fb996' },
          { key: 'Q3' as const, icon: '🚧', label: '遇到的阻礙？', notes: dailyNotesQ3, bg: '#fdf3f3', border: '#e6b1b1' },
        ];
        const holiday = getHoliday(d);
        const leavePeople = leaveStatus[d] || [];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setImagePreviewDay(null)}>
            <div className="flex flex-col items-center gap-4 max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => downloadDayImage(d)}
                  disabled={isGenerating}
                  className="bg-[#1F1D17] text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#5A574E] transition-all shadow-md flex items-center gap-2 disabled:opacity-60"
                >
                  {isGenerating ? '生成中...' : '下載圖片'}
                </button>
                <button onClick={() => setImagePreviewDay(null)} className="bg-white/20 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-white/30 transition-all">
                  關閉
                </button>
              </div>

              <div ref={imageCardRef} style={{
                width: '580px',
                background: '#fffdf9',
                borderRadius: '16px',
                border: '3px solid #5b755e',
                fontFamily: '"Georgia", "Times New Roman", serif',
                overflow: 'hidden',
                color: '#3e362e',
                boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
              }}>
                <div style={{ background: '#5b755e', padding: '18px 24px' }}>
                  {sprintName && <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px', marginBottom: '4px' }}>{sprintName}</div>}
                  <div style={{ color: 'white', fontSize: '22px', fontWeight: 'bold' }}>
                    Day {d + 1}
                    {holiday && <span style={{ fontSize: '14px', marginLeft: '10px', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '8px' }}>🎌 {holiday.name}</span>}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', marginTop: '4px' }}>
                    {getDayDate(d)} {getDayOfWeek(d)}
                  </div>
                </div>

                {leavePeople.length > 0 && (
                  <div style={{ background: '#fff9e6', borderBottom: '2px solid #f0c060', padding: '10px 24px', fontSize: '13px', color: '#7a5c00' }}>
                    🏖 本日請假：{leavePeople.join('、')}
                  </div>
                )}

                {qDefs.map((q, qi) => {
                  const hasContent = devNames.length > 0
                    ? devNames.some(n => !isOnLeave(d, n) && !!getPersonNote(q.notes, d, n))
                    : !!(typeof (q.notes as Record<number, unknown>)[d] === 'string' && (q.notes as Record<number, string>)[d]);
                  return (
                    <div key={q.key} style={{ borderTop: qi > 0 ? '2px solid #e8d5b5' : undefined, padding: '14px 24px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '10px', color: qi === 2 ? '#c96262' : '#5b755e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{q.icon}</span> {q.label}
                      </div>
                      {!hasContent && devNames.length > 0 ? (
                        <div style={{ fontSize: '13px', color: '#b5a695', fontStyle: 'italic' }}>（無紀錄）</div>
                      ) : devNames.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {devNames.map(name => {
                            if (isOnLeave(d, name)) return null;
                            const text = getPersonNote(q.notes, d, name);
                            if (!text) return null;
                            return (
                              <div key={name} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#5b755e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0, marginTop: '2px' }}>
                                  {name.charAt(0)}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '11px', color: '#8a7f72', marginBottom: '3px', fontWeight: 'bold' }}>{name}</div>
                                  <div style={{ background: q.bg, border: `1.5px solid ${q.border}`, borderRadius: '8px', padding: '7px 10px', fontSize: '13px', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                    {text}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ background: q.bg, border: `1.5px solid ${q.border}`, borderRadius: '8px', padding: '8px 12px', fontSize: '13px', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                          {typeof (q.notes as Record<number, unknown>)[d] === 'string' ? (q.notes as Record<number, string>)[d] : ''}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div style={{ background: '#e8eedd', padding: '10px 24px', fontSize: '11px', color: '#8a7f72', textAlign: 'center', borderTop: '2px solid #c8d8c0' }}>
                  Daily Scrum · {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
