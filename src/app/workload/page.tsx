"use client";
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, getDoc, query, where } from 'firebase/firestore';

interface Sprint {
  id: string;
  name: string;
  createdAt: number;
  ownerId?: string;
  collaboratorEmails?: string[];
  sprintStatus?: 'pending' | 'in-progress' | 'completed';
}

interface Dev {
  id: string;
  name: string;
  role: string;
}

interface Task {
  id: string;
  type: 'pbi' | 'task';
  status: 'pbi' | 'todo' | 'doing' | 'done' | 'accepted';
  title: string;
  role?: string;
  time?: string;
  pbiId?: string;
}

interface SprintProgress {
  total: number;
  done: number;
  doing: number;
  todo: number;
}

interface SprintWorkload {
  sprintId: string;
  sprintName: string;
  sprintDays: number;
  workingDays: number;
  startDate: string;
  devsList: Dev[];
  tasks: Task[];
  progress: SprintProgress;
}

interface PersonTask {
  title: string;
  hours: number;
  status: string;
  sprintName: string;
}

interface SprintBreakdown {
  sprintId: string;
  sprintName: string;
  sprintDays: number;
  workingDays: number;
  capacity: number;
  assigned: number;
  done: number;
  remaining: number;
  loadPct: number;
  taskCount: number;
  untimedCount: number;
}

interface PersonLoad {
  name: string;
  role: string;
  capacity: number;
  assigned: number;
  done: number;
  remaining: number;
  loadPct: number;
  tasks: PersonTask[];
  sprintBreakdown: SprintBreakdown[];
}

function calcWorkingDays(startDate: string, totalDays: number): number {
  if (!startDate || totalDays <= 0) return totalDays;
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return totalDays;
  let count = 0;
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count || 1;
}

function parseHours(timeStr: string | undefined): number {
  if (!timeStr) return 0;
  const s = timeStr.trim().toLowerCase();
  if (s.endsWith('d')) { const n = parseFloat(s); return isNaN(n) ? 0 : n * 8; }
  if (s.endsWith('h')) { const n = parseFloat(s); return isNaN(n) ? 0 : n; }
  if (s.endsWith('m')) { const n = parseFloat(s); return isNaN(n) ? 0 : n / 60; }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function loadLevel(pct: number) {
  if (pct === 0) return { bar: 'bg-[#d3cbbd]', badge: 'bg-[#f4f1ea] text-[#8a7f72]', border: 'border-[#d3cbbd]', label: '未分配' };
  if (pct <= 60) return { bar: 'bg-[#76a5af]', badge: 'bg-[#c2dce3] text-[#467386]', border: 'border-[#76a5af]', label: '輕鬆' };
  if (pct <= 80) return { bar: 'bg-[#8fb996]', badge: 'bg-[#e8eedd] text-[#4a7c59]', border: 'border-[#8fb996]', label: '正常' };
  if (pct <= 100) return { bar: 'bg-[#d4a373]', badge: 'bg-[#faebce] text-[#8b5a2b]', border: 'border-[#d4a373]', label: '繁忙' };
  return { bar: 'bg-[#e07a5f]', badge: 'bg-[#fceded] text-[#c96262]', border: 'border-[#e07a5f]', label: '過載' };
}

export default function WorkloadPage() {
  const { user, loading: authLoading } = useAuth();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sprintWorkloads, setSprintWorkloads] = useState<SprintWorkload[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [expandedPersons, setExpandedPersons] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);

  // Load sprint list
  useEffect(() => {
    if (authLoading) return;
    const load = async () => {
      let list: Sprint[] = [];
      if (user) {
        const q1 = query(collection(db, 'sprints'), where('ownerId', '==', user.uid));
        const snap1 = await getDocs(q1);
        snap1.forEach(d => list.push({ id: d.id, ...d.data() } as Sprint));
        const q2 = query(collection(db, 'sprints'), where('collaboratorEmails', 'array-contains', user.email));
        const snap2 = await getDocs(q2);
        snap2.forEach(d => { if (!list.find(s => s.id === d.id)) list.push({ id: d.id, ...d.data() } as Sprint); });
      } else {
        const stored = localStorage.getItem('sprints');
        if (stored) list = JSON.parse(stored);
      }
      list.sort((a, b) => b.createdAt - a.createdAt);
      setSprints(list);
      // 預設只選取非已完成的 Sprint
      const activeIds = list.filter(s => s.sprintStatus !== 'completed').map(s => s.id);
      setSelectedIds(new Set(activeIds));
    };
    load();
  }, [user, authLoading]);

  // Load workload data for selected sprints
  useEffect(() => {
    if (selectedIds.size === 0) { setSprintWorkloads([]); return; }
    const load = async () => {
      setLoadingData(true);
      const results: SprintWorkload[] = [];
      for (const sprintId of Array.from(selectedIds)) {
        const sprint = sprints.find(s => s.id === sprintId);
        if (!sprint) continue;
        try {
          const snap = await getDoc(doc(db, 'sprints', sprintId));
          if (snap.exists()) {
            const d = snap.data();
            const planning = d.planning || {};
            const backlog = d.backlog || {};
            const allTasks: Task[] = backlog.tasks || [];
            const taskItems = allTasks.filter((t: Task) => t.type === 'task');
            const sprintDays = Number(backlog.sprintDays) || 14;
            const startDate = planning.startDate || '';
            results.push({
              sprintId,
              sprintName: sprint.name,
              sprintDays,
              workingDays: calcWorkingDays(startDate, sprintDays),
              startDate,
              devsList: (planning.devsList || []).filter((dev: Dev) => dev.name?.trim()),
              tasks: taskItems,
              progress: {
                total: taskItems.length,
                done: taskItems.filter((t: Task) => t.status === 'done').length,
                doing: taskItems.filter((t: Task) => t.status === 'doing').length,
                todo: taskItems.filter((t: Task) => t.status === 'todo').length,
              },
            });
          }
        } catch { /* skip inaccessible sprints */ }
      }
      // Sort newest first
      results.sort((a, b) => {
        const ia = sprints.findIndex(s => s.id === a.sprintId);
        const ib = sprints.findIndex(s => s.id === b.sprintId);
        return ia - ib;
      });
      setSprintWorkloads(results);
      setLoadingData(false);
    };
    load();
  }, [selectedIds, sprints]);

  const personLoads = useMemo<PersonLoad[]>(() => {
    const map = new Map<string, PersonLoad>();

    for (const sw of sprintWorkloads) {
      for (const dev of sw.devsList) {
        const key = dev.name.trim();
        if (!map.has(key)) {
          map.set(key, { name: key, role: dev.role || '', capacity: 0, assigned: 0, done: 0, remaining: 0, loadPct: 0, tasks: [], sprintBreakdown: [] });
        }
        const p = map.get(key)!;
        const cap = sw.workingDays * 8;
        p.capacity += cap;
        if (!p.role && dev.role) p.role = dev.role;

        // Per-sprint breakdown
        const myTasks = sw.tasks.filter(t => t.role?.split(',').map(r => r.trim()).includes(key));
        const sprintAssigned = myTasks.reduce((s, t) => s + parseHours(t.time), 0);
        const sprintDone = myTasks.filter(t => t.status === 'done').reduce((s, t) => s + parseHours(t.time), 0);
        const sprintRemaining = sprintAssigned - sprintDone;
        p.sprintBreakdown.push({
          sprintId: sw.sprintId,
          sprintName: sw.sprintName,
          sprintDays: sw.sprintDays,
          workingDays: sw.workingDays,
          capacity: cap,
          assigned: sprintAssigned,
          done: sprintDone,
          remaining: sprintRemaining,
          loadPct: cap > 0 ? Math.round(sprintAssigned / cap * 100) : 0,
          taskCount: myTasks.length,
          untimedCount: myTasks.filter(t => !t.time || parseHours(t.time) === 0).length,
        });
      }

      for (const task of sw.tasks) {
        if (!task.role) continue;
        const assignees = task.role.split(',').map(r => r.trim()).filter(Boolean);
        const hrs = parseHours(task.time);
        for (const assignee of assignees) {
          if (!map.has(assignee)) continue;
          const p = map.get(assignee)!;
          p.assigned += hrs;
          if (task.status === 'done') p.done += hrs;
          else p.remaining += hrs;
          p.tasks.push({ title: task.title, hours: hrs, status: task.status, sprintName: sw.sprintName });
        }
      }
    }

    map.forEach(p => {
      p.loadPct = p.capacity > 0 ? Math.round(p.assigned / p.capacity * 100) : 0;
    });

    const arr: PersonLoad[] = [];
    map.forEach(p => arr.push(p));
    return arr.sort((a, b) => b.loadPct - a.loadPct);
  }, [sprintWorkloads]);

  const toggleSprint = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const togglePerson = (name: string) => {
    setExpandedPersons(prev => {
      const next = new Set(prev);
      if (next.has(name)) { next.delete(name); } else { next.add(name); }
      return next;
    });
  };

  const totalCapacity = personLoads.reduce((s, p) => s + p.capacity, 0);
  const totalAssigned = personLoads.reduce((s, p) => s + p.assigned, 0);
  const avgLoad = totalCapacity > 0 ? Math.round(totalAssigned / totalCapacity * 100) : 0;
  const overloadedCount = personLoads.filter(p => p.loadPct > 100).length;
  const idleCount = personLoads.filter(p => p.loadPct === 0).length;

  const statusDot = (status: string) => {
    if (status === 'done') return 'bg-[#8fb996]';
    if (status === 'doing') return 'bg-[#d4a373]';
    return 'bg-[#e6b1b1]';
  };

  const statusLabel = (status: string) => {
    if (status === 'done') return '已完成';
    if (status === 'doing') return '進行中';
    return '待處理';
  };

  return (
    <main className="min-h-screen bg-[#f4f1ea] p-4 md:p-8 font-serif text-[#3e362e]">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-[#fffdf9] border-4 border-[#5b755e] p-6 rounded-3xl shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#5b755e] flex items-center gap-2">
                <span>⚖️</span> 人員負荷分析
              </h1>
              <p className="text-sm text-[#8a7f72] mt-1">
                依據每個 Sprint 的 Planning 人員設定與 Backlog 任務分配，計算每位成員的工時負荷，協助管理人員有效調度。
              </p>
            </div>
            <Link
              href="/"
              className="bg-[#e8eedd] text-[#5b755e] border-2 border-[#8fb996] px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#dcedc1] transition-all flex items-center gap-2 shrink-0"
            >
              <span>📚</span> 回到大廳
            </Link>
          </div>
        </div>

        {/* Sprint Filter */}
        {(() => {
          const activeSprints = sprints.filter(s => s.sprintStatus !== 'completed');
          const completedSprints = sprints.filter(s => s.sprintStatus === 'completed');
          const visibleSprints = showCompleted ? sprints : activeSprints;
          const allVisibleSelected = visibleSprints.length > 0 && visibleSprints.every(s => selectedIds.has(s.id));
          return (
            <div className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-[#5b755e] shrink-0">選擇 Sprint：</span>
                <button
                  onClick={() => {
                    if (allVisibleSelected) {
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        visibleSprints.forEach(s => next.delete(s.id));
                        return next;
                      });
                    } else {
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        visibleSprints.forEach(s => next.add(s.id));
                        return next;
                      });
                    }
                  }}
                  className={`text-xs px-3 py-1.5 rounded-full font-bold border-2 transition-all shrink-0 ${allVisibleSelected ? 'bg-[#5b755e] text-white border-[#5b755e]' : 'bg-white text-[#5b755e] border-[#8fb996] hover:bg-[#e8eedd]'}`}
                >
                  全選
                </button>
                {visibleSprints.map(s => (
                  <button
                    key={s.id}
                    onClick={() => toggleSprint(s.id)}
                    title={s.name}
                    className={`text-xs px-3 py-1.5 rounded-full font-bold border-2 transition-all max-w-[180px] truncate ${selectedIds.has(s.id) ? 'bg-[#e07a5f] text-white border-[#e07a5f]' : 'bg-white text-[#8a7f72] border-[#d3cbbd] hover:border-[#b5a695]'}`}
                  >
                    {s.name}
                  </button>
                ))}
                {visibleSprints.length === 0 && !authLoading && (
                  <span className="text-xs text-[#b5a695] italic">目前無進行中或待開始的 Sprint</span>
                )}
              </div>
              {completedSprints.length > 0 && (
                <div className="flex items-center gap-2 pt-1 border-t border-[#f4f1ea]">
                  <button
                    onClick={() => setShowCompleted(v => !v)}
                    className={`text-xs px-3 py-1 rounded-full font-bold border-2 transition-all ${showCompleted ? 'bg-[#8a7f72] text-white border-[#8a7f72]' : 'bg-white text-[#8a7f72] border-[#d3cbbd] hover:border-[#b5a695]'}`}
                  >
                    {showCompleted ? '隱藏已完成' : `顯示已完成（${completedSprints.length}）`}
                  </button>
                  {showCompleted && completedSprints.map(s => (
                    <button
                      key={s.id}
                      onClick={() => toggleSprint(s.id)}
                      title={s.name}
                      className={`text-xs px-3 py-1.5 rounded-full font-bold border-2 transition-all max-w-[180px] truncate opacity-70 ${selectedIds.has(s.id) ? 'bg-[#8a7f72] text-white border-[#8a7f72]' : 'bg-white text-[#8a7f72] border-[#d3cbbd] hover:border-[#b5a695]'}`}
                    >
                      ✅ {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Summary Cards */}
        {!loadingData && personLoads.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#e8eedd] border-2 border-[#a5c2a8] rounded-2xl p-4 text-center">
              <div className="text-3xl font-bold text-[#4a7c59]">{personLoads.length}</div>
              <div className="text-xs font-bold text-[#5b755e] mt-1">👥 參與人員</div>
            </div>
            <div className={`border-2 rounded-2xl p-4 text-center ${avgLoad > 100 ? 'bg-[#fceded] border-[#e6b1b1]' : avgLoad > 80 ? 'bg-[#faebce] border-[#e6c98a]' : 'bg-[#c2dce3] border-[#76a5af]'}`}>
              <div className={`text-3xl font-bold ${avgLoad > 100 ? 'text-[#c96262]' : avgLoad > 80 ? 'text-[#d4a373]' : 'text-[#467386]'}`}>{avgLoad}%</div>
              <div className="text-xs font-bold text-[#6b5e50] mt-1">📊 平均負荷率</div>
            </div>
            <div className={`border-2 rounded-2xl p-4 text-center ${overloadedCount > 0 ? 'bg-[#fceded] border-[#e6b1b1]' : 'bg-[#f4f1ea] border-[#d3cbbd]'}`}>
              <div className={`text-3xl font-bold ${overloadedCount > 0 ? 'text-[#c96262]' : 'text-[#8a7f72]'}`}>{overloadedCount}</div>
              <div className="text-xs font-bold text-[#6b5e50] mt-1">🔴 過載人員</div>
            </div>
            <div className={`border-2 rounded-2xl p-4 text-center ${idleCount > 0 ? 'bg-[#e8f0f4] border-[#a8c4d0]' : 'bg-[#f4f1ea] border-[#d3cbbd]'}`}>
              <div className={`text-3xl font-bold ${idleCount > 0 ? 'text-[#76a5af]' : 'text-[#8a7f72]'}`}>{idleCount}</div>
              <div className="text-xs font-bold text-[#6b5e50] mt-1">⭕ 未分配人員</div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loadingData && (
          <div className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-2xl p-10 text-center text-[#8a7f72] animate-pulse font-bold">
            載入工時資料中...
          </div>
        )}

        {/* Empty */}
        {!loadingData && selectedIds.size > 0 && personLoads.length === 0 && (
          <div className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-2xl p-10 text-center space-y-2">
            <div className="text-5xl">📭</div>
            <p className="font-bold text-[#8a7f72]">所選 Sprint 尚未設定開發人員或尚無任務</p>
            <p className="text-sm text-[#b5a695]">請先至 Sprint Planning 設定開發人員，並在 Backlog 填寫任務指派人與預估工時。</p>
          </div>
        )}

        {/* Per-person workload */}
        {!loadingData && personLoads.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#5b755e] flex items-center gap-2">
                <span>👤</span> 人員負荷明細
              </h2>
              <div className="flex items-center gap-3 text-xs text-[#8a7f72]">
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#76a5af]" />輕鬆 ≤60%</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#8fb996]" />正常 ≤80%</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#d4a373]" />繁忙 ≤100%</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#e07a5f]" />過載 &gt;100%</span>
              </div>
            </div>

            {personLoads.map(p => {
              const lv = loadLevel(p.loadPct);
              const isExpanded = expandedPersons.has(p.name);
              const totalUntimedTasks = p.tasks.filter(t => t.hours === 0).length;

              return (
                <div key={p.name} className={`bg-[#fffdf9] border-2 rounded-2xl overflow-hidden transition-all ${lv.border}`}>
                  <button
                    className="w-full p-4 flex items-center gap-3 text-left hover:bg-[#faf8f5] transition-colors"
                    onClick={() => togglePerson(p.name)}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-[#5b755e] text-white font-bold text-base flex items-center justify-center shrink-0 select-none">
                      {p.name.charAt(0)}
                    </div>

                    {/* Name */}
                    <div className="w-28 shrink-0 min-w-0">
                      <div className="font-bold text-[#3e362e] truncate">{p.name}</div>
                    </div>

                    {/* Progress bar + formula */}
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Formula row */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8a7f72]">
                          負荷率 ＝
                          <strong className={p.assigned > 0 ? 'text-[#3e362e]' : 'text-[#b5a695]'}> {p.assigned}h</strong>
                          <span className="text-[#b5a695]"> 已分配 ÷ </span>
                          <strong className="text-[#3e362e]">{p.capacity}h</strong>
                          <span className="text-[#b5a695]"> 容量</span>
                        </span>
                        <span className="hidden sm:flex items-center gap-2 text-[10px] text-[#8a7f72]">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#8fb996] inline-block"/>完成 {p.done}h</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#d4a373] inline-block"/>待完成 {p.remaining}h</span>
                        </span>
                      </div>
                      {/* Stacked bar */}
                      <div className="relative w-full h-5 rounded-lg bg-[#e8e4d9] overflow-hidden border border-[#d3cbbd]">
                        {p.done > 0 && (
                          <div
                            className="absolute left-0 top-0 h-full bg-[#8fb996] transition-all duration-700"
                            style={{ width: `${Math.min(p.capacity > 0 ? p.done / p.capacity * 100 : 0, 100)}%` }}
                          />
                        )}
                        {p.remaining > 0 && (
                          <div
                            className={`absolute top-0 h-full ${lv.bar} transition-all duration-700`}
                            style={{
                              left: `${Math.min(p.capacity > 0 ? p.done / p.capacity * 100 : 0, 100)}%`,
                              width: `${Math.min(p.capacity > 0 ? p.remaining / p.capacity * 100 : 0, 100)}%`
                            }}
                          />
                        )}
                        {/* Percentage label inside bar */}
                        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[#6b5e50] mix-blend-multiply">
                          {p.assigned}h / {p.capacity}h
                        </span>
                      </div>
                      {totalUntimedTasks > 0 && (
                        <p className="text-[10px] text-[#b5a695]">⚠ {totalUntimedTasks} 項任務未填工時，實際負荷可能更高</p>
                      )}
                    </div>

                    {/* Badge */}
                    <div className={`text-sm font-bold px-3 py-2 rounded-xl shrink-0 text-center min-w-[64px] ${lv.badge}`}>
                      <div className="text-base leading-none">{p.loadPct}%</div>
                      <div className="text-[10px] font-normal mt-0.5">{lv.label}</div>
                    </div>

                    <span className="text-[#b5a695] shrink-0 text-sm">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {/* Expanded: sprint breakdown + task list */}
                  {isExpanded && (
                    <div className="border-t-2 border-[#f4f1ea]">
                      {/* Sprint breakdown */}
                      <div className="px-4 pt-3 pb-2">
                        <p className="text-xs font-bold text-[#5b755e] mb-2">📅 各 Sprint 容量明細</p>
                        <div className="space-y-1.5">
                          {p.sprintBreakdown.map(sb => {
                            const sbLv = loadLevel(sb.loadPct);
                            return (
                              <div key={sb.sprintId} className="flex items-center gap-2 bg-[#f4f1ea] rounded-xl px-3 py-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-[#3e362e] truncate max-w-[160px]">{sb.sprintName}</span>
                                    <span className="text-[10px] text-[#8a7f72] bg-white px-1.5 py-0.5 rounded border border-[#e8d5b5] shrink-0">
                                      {sb.workingDays}工作天 × 8h ＝ {sb.capacity}h
                                      {sb.workingDays < sb.sprintDays && (
                                        <span className="text-[#b5a695] ml-1">(共{sb.sprintDays}天)</span>
                                      )}
                                    </span>
                                  </div>
                                  {/* Mini bar */}
                                  <div className="mt-1 w-full h-2 rounded-full bg-[#e8e4d9] overflow-hidden border border-[#d3cbbd] flex">
                                    {sb.done > 0 && <div className="h-full bg-[#8fb996]" style={{ width: `${Math.min(sb.capacity > 0 ? sb.done/sb.capacity*100 : 0, 100)}%` }} />}
                                    {sb.remaining > 0 && <div className={`h-full ${sbLv.bar}`} style={{ width: `${Math.min(sb.capacity > 0 ? sb.remaining/sb.capacity*100 : 0, 100)}%` }} />}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${sbLv.badge}`}>{sb.loadPct}%</div>
                                  <div className="text-[10px] text-[#8a7f72] mt-0.5">{sb.assigned}h / {sb.capacity}h</div>
                                  {sb.untimedCount > 0 && <div className="text-[10px] text-[#b5a695]">⚠ {sb.untimedCount} 項無工時</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Task list */}
                      {p.tasks.length > 0 && (
                        <div className="px-4 pb-4 pt-1">
                          <p className="text-xs font-bold text-[#5b755e] mb-2">📋 指派任務</p>
                          <div className="space-y-1.5">
                            {p.tasks.map((t, i) => (
                              <div key={i} className="flex items-center gap-3 text-sm bg-[#f4f1ea] rounded-xl px-3 py-2">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(t.status)}`} />
                                <span className="flex-1 truncate text-[#3e362e]">{t.title}</span>
                                <span className="text-[10px] text-[#8a7f72] shrink-0 hidden sm:block">{statusLabel(t.status)}</span>
                                <span className="text-[10px] text-[#8a7f72] shrink-0 bg-white px-1.5 py-0.5 rounded border border-[#e8d5b5]">{t.sprintName}</span>
                                <span className="text-xs font-bold text-[#5b755e] shrink-0 bg-[#e8eedd] px-2 py-0.5 rounded-full min-w-[36px] text-center">
                                  {t.hours > 0 ? `${t.hours}h` : '—'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {p.tasks.length === 0 && (
                        <p className="text-xs text-[#b5a695] italic text-center py-3 px-4">此人員在所選 Sprint 中尚無任務分配</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Cross-sprint comparison table */}
        {!loadingData && sprintWorkloads.length > 1 && personLoads.length > 0 && (
          <div className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-2xl overflow-hidden">
            <div className="bg-[#5b755e] p-4 text-white font-bold flex items-center gap-2">
              <span>📈</span> Sprint 跨期負荷比較
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#f4f1ea]">
                    <th className="p-3 text-left text-[#5b755e] font-bold sticky left-0 bg-[#f4f1ea] border-b-2 border-[#e8d5b5]">人員</th>
                    {sprintWorkloads.map(sw => {
                      const doneRate = sw.progress.total > 0 ? Math.round(sw.progress.done / sw.progress.total * 100) : 0;
                      const doingRate = sw.progress.total > 0 ? Math.round(sw.progress.doing / sw.progress.total * 100) : 0;
                      // 計算已進行天數
                      let elapsedDays = 0;
                      let dayPct = 0;
                      if (sw.startDate) {
                        const start = new Date(sw.startDate);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        start.setHours(0, 0, 0, 0);
                        const diffMs = today.getTime() - start.getTime();
                        elapsedDays = Math.max(0, Math.min(Math.floor(diffMs / 86400000) + 1, sw.sprintDays));
                        dayPct = Math.round(elapsedDays / sw.sprintDays * 100);
                      }
                      const notStarted = sw.startDate && new Date(sw.startDate) > new Date();
                      return (
                        <th key={sw.sprintId} className="p-3 text-center text-[#5b755e] font-bold min-w-[130px] border-b-2 border-[#e8d5b5]">
                          <div className="truncate max-w-[120px] mx-auto text-xs" title={sw.sprintName}>{sw.sprintName}</div>
                          {/* 天數進度 */}
                          {sw.startDate ? (
                            notStarted ? (
                              <div className="text-[10px] text-[#b5a695] font-normal mb-1">共 {sw.sprintDays} 天 / {sw.workingDays} 工作天｜尚未開始</div>
                            ) : (
                              <div className="text-[10px] text-[#6b5e50] font-bold mb-1">
                                第 {elapsedDays} 天 / {sw.sprintDays} 天 · {sw.workingDays} 工作天
                              </div>
                            )
                          ) : (
                            <div className="text-[10px] text-[#b5a695] font-normal mb-1">共 {sw.sprintDays} 天 / {sw.workingDays} 工作天</div>
                          )}
                          {/* 時間進度條 */}
                          <div className="w-full h-1.5 rounded-full bg-[#e8e4d9] overflow-hidden border border-[#d3cbbd] mb-1">
                            <div className="h-full bg-[#b5a695] transition-all" style={{ width: `${dayPct}%` }} />
                          </div>
                          {/* 任務完成進度條 */}
                          <div className="w-full h-2 rounded-full bg-[#e8e4d9] overflow-hidden border border-[#d3cbbd] flex">
                            {sw.progress.done > 0 && (
                              <div className="h-full bg-[#8fb996]" style={{ width: `${doneRate}%` }} />
                            )}
                            {sw.progress.doing > 0 && (
                              <div className="h-full bg-[#d4a373]" style={{ width: `${doingRate}%` }} />
                            )}
                          </div>
                          {sw.progress.total > 0 ? (
                            <div className="text-[10px] font-bold mt-0.5 text-[#4a7c59]">{doneRate}% 完成</div>
                          ) : (
                            <div className="text-[10px] font-normal mt-0.5 text-[#d3cbbd]">尚無任務</div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {personLoads.map((p, ri) => (
                    <tr key={p.name} className={ri % 2 === 0 ? 'bg-white' : 'bg-[#faf8f5]'}>
                      <td className="p-3 font-bold sticky left-0 text-[#3e362e] border-b border-[#f4f1ea]" style={{ background: ri % 2 === 0 ? 'white' : '#faf8f5' }}>
                        {p.name}
                      </td>
                      {sprintWorkloads.map(sw => {
                        const devInSprint = sw.devsList.find(d => d.name.trim() === p.name);
                        if (!devInSprint) {
                          return (
                            <td key={sw.sprintId} className="p-3 text-center text-[#d3cbbd] border-b border-[#f4f1ea]">—</td>
                          );
                        }
                        const cap = sw.workingDays * 8;
                        const assigned = sw.tasks
                          .filter(t => t.role?.split(',').map(r => r.trim()).includes(p.name))
                          .reduce((s, t) => s + parseHours(t.time), 0);
                        const pct = cap > 0 ? Math.round(assigned / cap * 100) : 0;
                        const lv = loadLevel(pct);
                        return (
                          <td key={sw.sprintId} className="p-3 text-center border-b border-[#f4f1ea]">
                            <div className={`inline-flex flex-col items-center text-xs font-bold px-2.5 py-1 rounded-full ${lv.badge}`}>
                              <span>{pct}%</span>
                              <span className="text-[10px] font-normal opacity-80">{assigned}h/{cap}h</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="bg-[#fffdf9] border-2 border-[#e8d5b5] rounded-2xl p-4 text-xs text-[#8a7f72] space-y-1">
          <p className="font-bold text-[#6b5e50]">使用說明</p>
          <p>• <strong>容量</strong> = 工作天數（扣除週六、週日）× 8 小時；若未設定開始日期則以總天數計算</p>
          <p>• <strong>負荷率</strong> = 任務預估工時總和 ÷ 容量 × 100%</p>
          <p>• 任務負責人欄位支援多人（逗號分隔），工時平均分配給每位負責人計算</p>
          <p>• Backlog 任務需填寫「工時」欄位（如 4h / 2d / 30m），才能準確計算負荷</p>
        </div>

      </div>
    </main>
  );
}
