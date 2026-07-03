"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
  Home, Printer, Calendar, X, BarChart2, TrendingUp,
  ChevronDown, ChevronUp, Target, Users, CheckCircle2,
  FileText, Sprout, AlertTriangle, Zap, User, ClipboardList, Clock,
} from 'lucide-react';

interface Task {
  id: string;
  title?: string;
  status?: string;
  type?: string;
  pbiId?: string;
  acceptedBy?: string;
  role?: string;
  time?: string;
  desc?: string;
}

interface SprintDoc {
  id: string;
  name: string;
  createdAt: number;
  sprintStatus?: 'pending' | 'in-progress' | 'completed';
  planning?: {
    goal?: string;
    startDate?: string;
    duration?: string;
    po?: string;
    sm?: string;
    devs?: string;
    devsList?: { id: string; name: string; role: string }[];
    pbis?: { id: string; title: string }[];
    sprintName?: string;
  };
  backlog?: { tasks?: Task[] };
  daily?: { completedDays?: boolean[] };
  review?: { opening?: string; demo?: string; market?: string; future?: string };
  retrospective?: { keepStart?: string; problemStop?: string; actionItems?: string; previousActions?: string };
  editHistory?: { email: string; name: string; ts: number; page: string }[];
}

function getDevNames(planning: SprintDoc['planning']): string[] {
  if (!planning) return [];
  if (Array.isArray(planning.devsList) && planning.devsList.length > 0)
    return planning.devsList.map(d => d.name).filter(Boolean);
  if (typeof planning.devs === 'string' && planning.devs)
    return planning.devs.split(',').map(n => n.trim()).filter(Boolean);
  return [];
}

function pct(n: number, total: number) {
  return total > 0 ? Math.round(n / total * 100) : 0;
}

function inferStatus(sprint: SprintDoc): 'pending' | 'in-progress' | 'completed' {
  if (sprint.sprintStatus) return sprint.sprintStatus;
  const allItems = sprint.backlog?.tasks || [];
  const pbis = allItems.filter((t: Task) => t.status === 'pbi');
  const pbiIdSet = new Set(pbis.map((t: Task) => t.id));
  const tasks = allItems.filter((t: Task) => t.type === 'task' && t.pbiId && pbiIdSet.has(t.pbiId));
  if (tasks.length === 0) return 'pending';
  const todo  = tasks.filter((t: Task) => t.status === 'todo').length;
  const doing = tasks.filter((t: Task) => t.status === 'doing').length;
  if (todo === 0 && doing === 0) return 'completed';
  if (doing > 0) return 'in-progress';
  return 'pending';
}

function MiniBar({ value, max, color = '#C96442' }: { value: number; max: number; color?: string }) {
  const p = pct(value, max);
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-[#F1EEE6] rounded-full h-1 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold w-9 text-right" style={{ color }}>{p}%</span>
    </div>
  );
}

// ── 趨勢圖元件 ──────────────────────────────────────────
interface ChartPoint {
  label: string;
  fullName: string;
  completionRate: number;
  acceptanceRate: number;
  taskCount: number;
  doneCount: number;
  startDate: string;
  endDate: string;
  isCompleted: boolean;
}

function fmtDate(d: string): string {
  if (!d) return '';
  const m = d.match(/^\d{4}[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (m) return `${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}`;
  const m2 = d.match(/^(\d{1,2})[-\/](\d{1,2})/);
  if (m2) return `${m2[1].padStart(2,'0')}/${m2[2].padStart(2,'0')}`;
  return d.slice(0, 6);
}

function TrendCharts({ data, completedCount, totalCount }: { data: ChartPoint[]; completedCount: number; totalCount: number }) {
  const hasTasks = data.some(d => d.taskCount > 0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  if (!hasTasks) return null;

  const W = 720, H = 260;
  const PL = 42, PR = 12, PT = 22, PB = 56;
  const cW = W - PL - PR;
  const cH = H - PT - PB;
  const n = data.length;

  const parseDateMs = (s: string): number | null => {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.getTime();
  };
  const fmtShort = (ms: number) => {
    const d = new Date(ms);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const sortedByDate = [...data]
    .map(d => ({ ...d, dateMs: parseDateMs(d.startDate) }))
    .filter(d => d.dateMs !== null)
    .sort((a, b) => a.dateMs! - b.dateMs!);

  const hasDateData = sortedByDate.length >= 2;
  const firstDateMs = hasDateData ? sortedByDate[0].dateMs! : null;
  const lastDateMs  = hasDateData ? sortedByDate[sortedByDate.length - 1].dateMs! : null;
  const totalDays   = firstDateMs && lastDateMs ? Math.round((lastDateMs - firstDateMs) / 86400000) : 0;
  const monthsStr   = totalDays >= 30 ? `約 ${Math.round(totalDays / 30)} 個月` : totalDays > 0 ? `${totalDays} 天` : '';

  const dateSpan = (firstDateMs && lastDateMs && lastDateMs > firstDateMs)
    ? (lastDateMs - firstDateMs) * 1.08 : 86400000 * 30;
  const xFromDate = (ms: number) =>
    firstDateMs ? Math.min(W - PR - 2, PL + ((ms - firstDateMs) / dateSpan) * cW) : PL;

  let cum = 0;
  const dateSteps = sortedByDate.map(d => {
    const before = cum;
    if (d.isCompleted) cum++;
    return { ...d, cumBefore: before, cumAfter: cum };
  });
  const maxCum = Math.max(cum, 1);
  const yCum = (v: number) => PT + cH - (v / maxCum) * cH;

  const curvePoints = [
    { x: PL, y: PT + cH },
    ...dateSteps.map(s => ({ x: xFromDate(s.dateMs!), y: yCum(s.cumAfter) })),
  ];
  let smoothPath = `M ${curvePoints[0].x.toFixed(1)} ${curvePoints[0].y.toFixed(1)}`;
  for (let i = 0; i < curvePoints.length - 1; i++) {
    const p1 = curvePoints[i], p2 = curvePoints[i + 1];
    const mx = ((p1.x + p2.x) / 2).toFixed(1);
    smoothPath += ` C ${mx},${p1.y.toFixed(1)} ${mx},${p2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  const rightEdge = (W - PR).toFixed(1);
  smoothPath += ` L ${rightEdge} ${yCum(cum).toFixed(1)}`;
  const smoothArea = smoothPath + ` L ${rightEdge} ${(PT + cH).toFixed(1)} L ${PL} ${(PT + cH).toFixed(1)} Z`;

  const completedItems = dateSteps
    .map((s, i) => s.isCompleted ? { s, i, cx: xFromDate(s.dateMs!), cy: yCum(s.cumAfter) } : null)
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const clusters: (typeof completedItems)[] = [];
  for (const item of completedItems) {
    const last = clusters[clusters.length - 1];
    if (!last || item.cx - last[last.length - 1].cx >= 25) {
      clusters.push([item]);
    } else {
      last.push(item);
    }
  }

  const labelMap = new Map<number, { x: number; y: number }>();
  for (const cluster of clusters) {
    const clusterSize = cluster.length;
    if (clusterSize === 1) {
      const { i, cx, cy } = cluster[0];
      labelMap.set(i, { x: cx, y: cy - 16 < PT + 4 ? cy + 18 : cy - 16 });
    } else {
      const avgCx = cluster.reduce((sum, c) => sum + c.cx, 0) / clusterSize;
      const spread = 22;
      cluster.forEach(({ i, cy }, j) => {
        const lx = avgCx - ((clusterSize - 1) * spread) / 2 + j * spread;
        const above = j % 2 === 0;
        const ly = above
          ? (cy - 16 < PT + 4 ? cy + 18 : cy - 16)
          : (cy + 18 > PT + cH - 4 ? cy - 16 : cy + 18);
        labelMap.set(i, { x: lx, y: ly });
      });
    }
  }

  const weekLabels: { x: number; label: string }[] = [];
  if (firstDateMs && lastDateMs) {
    const start = new Date(firstDateMs);
    const dow = start.getDay();
    const cur = new Date(start);
    cur.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
    cur.setHours(0, 0, 0, 0);
    for (let w = 0; w < 52; w++) {
      const ms = cur.getTime();
      if (ms > lastDateMs + 8 * 86400000) break;
      const x = xFromDate(ms);
      if (x >= PL && x <= W - PR) {
        weekLabels.push({ x, label: `${cur.getMonth() + 1}/${cur.getDate()}` });
      }
      cur.setDate(cur.getDate() + 7);
    }
  }

  const yGridStep = Math.ceil(maxCum / 4);
  const yGridVals: number[] = [];
  for (let v = 0; v <= maxCum; v += yGridStep) yGridVals.push(v);
  if (!yGridVals.includes(maxCum)) yGridVals.push(maxCum);

  const xPos = (i: number) => n === 1 ? PL + cW / 2 : PL + (i / (n - 1)) * cW;
  const maxTasks = Math.max(...data.map(d => d.taskCount), 1);
  const barW = Math.min(38, (cW / Math.max(n, 1)) * 0.52);
  const grids = [0, 25, 50, 75, 100];

  return (
    <section className="bg-white border border-[#E9E5DA] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#C96442] flex items-center justify-center flex-shrink-0">
            <BarChart2 size={13} strokeWidth={2} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#1F1D17]">成效趨勢一覽</div>
            <div className="text-[10px] text-[#8B887E]">Scrum 導入後的專案完成速度與任務產出量</div>
          </div>
        </div>
        <div className="flex items-stretch divide-x divide-[#E9E5DA] bg-white border border-[#E9E5DA] rounded-lg overflow-hidden flex-shrink-0">
          {[
            { label: 'Sprint 總數', value: totalCount },
            { label: '已完成', value: completedCount },
            { label: '進行/待開始', value: totalCount - completedCount },
          ].map(({ label, value }) => (
            <div key={label} className="px-4 py-2 text-center">
              <div className="text-xl font-semibold text-[#1F1D17] leading-none">{value}</div>
              <div className="text-[10px] text-[#8B887E] mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 pt-4 grid md:grid-cols-2 gap-6">
        {/* 左：日期時間軸 × 累積完成 Sprint 數 */}
        <div>
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
            <div className="text-[10px] font-semibold text-[#8B887E] uppercase tracking-widest">專案完成時間軸</div>
            {monthsStr && completedCount > 0 && firstDateMs && lastDateMs && (
              <div className="text-xs bg-[#F5E4DA] border border-[#F5E4DA] rounded-lg px-2.5 py-1 text-[#7A3520]">
                {fmtShort(firstDateMs)} 起，{monthsStr}完成 {completedCount} 個 Sprint
              </div>
            )}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 240 }}>
            <defs>
              <linearGradient id="rg-step" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C96442" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#C96442" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Y 格線 */}
            {yGridVals.map(v => (
              <g key={v}>
                <line x1={PL} y1={yCum(v)} x2={W-PR} y2={yCum(v)}
                  stroke={v === 0 ? '#D8D3C5' : '#E9E5DA'} strokeWidth={v === 0 ? 1.5 : 1} />
                <text x={PL-5} y={yCum(v)+4} textAnchor="end" fontSize="10" fill="#B5B2A6">{v}</text>
              </g>
            ))}
            {/* 週次垂直格線 */}
            {weekLabels.map((wl, i) => (
              <g key={i}>
                <line x1={wl.x} y1={PT} x2={wl.x} y2={PT+cH} stroke="#E9E5DA" strokeWidth="1" strokeDasharray="3 3" />
                <text x={wl.x} y={PT+cH+14} textAnchor="middle" fontSize="9" fill="#B5B2A6">{wl.label}</text>
              </g>
            ))}
            {/* 面積填充 */}
            {hasDateData && <path d={smoothArea} fill="url(#rg-step)" />}
            {/* 曲線 */}
            {hasDateData && <path d={smoothPath} fill="none" stroke="#C96442" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
            {/* Sprint 節點 */}
            {dateSteps.map((s, i) => {
              const cx = xFromDate(s.dateMs!);
              const cy = yCum(s.cumAfter);
              return (
                <g key={i}>
                  <circle cx={cx} cy={cy} r="14" fill="transparent" style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)} />
                  <circle cx={cx} cy={cy} r={hoveredIdx === i ? 7 : 5}
                    fill={s.isCompleted ? '#C96442' : 'white'}
                    stroke="#C96442" strokeWidth="2.5"
                    style={{ transition: 'r 0.15s', pointerEvents: 'none' }} />
                  {s.isCompleted && labelMap.has(i) && (
                    <text x={labelMap.get(i)!.x} y={labelMap.get(i)!.y} textAnchor="middle" fontSize="10" fill="#C96442" fontWeight="bold"
                      stroke="white" strokeWidth="3" paintOrder="stroke fill" style={{ pointerEvents: 'none' }}>{s.cumAfter}</text>
                  )}
                </g>
              );
            })}
            {/* Tooltip */}
            {hoveredIdx !== null && (() => {
              const s = dateSteps[hoveredIdx];
              const cx = xFromDate(s.dateMs!);
              const cy = yCum(s.cumAfter);
              const TW = 210, TH = 82, GAP = 14;
              const tipX = cx + GAP + TW > W - PR ? cx - TW - GAP : cx + GAP;
              const tipY = Math.max(PT, Math.min(cy - TH / 2, PT + cH - TH));
              const name = s.fullName.length > 18 ? s.fullName.slice(0, 18) + '…' : s.fullName;
              return (
                <g style={{ pointerEvents: 'none' }}>
                  <rect x={tipX} y={tipY} width={TW} height={TH} rx="8"
                    fill="white" stroke="#E9E5DA" strokeWidth="1"
                    style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))' }} />
                  <text x={tipX + 12} y={tipY + 18} fontSize="11" fill="#1F1D17" fontWeight="bold">{s.label}　{name}</text>
                  <line x1={tipX + 12} y1={tipY + 25} x2={tipX + TW - 12} y2={tipY + 25} stroke="#E9E5DA" strokeWidth="1" />
                  <text x={tipX + 12} y={tipY + 40} fontSize="10" fill="#8B887E">開始：{s.startDate ? fmtDate(s.startDate) : '—'}</text>
                  <text x={tipX + 12} y={tipY + 56} fontSize="10" fill="#8B887E">{s.isCompleted ? '✓ 已完成' : '⟳ 進行中'}</text>
                  <text x={tipX + 12} y={tipY + 72} fontSize="10" fill="#C96442" fontWeight="bold">累積完成 {s.cumAfter} 個 Sprint</text>
                </g>
              );
            })()}
          </svg>
        </div>

        {/* 右：Sprint 速度長條圖 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-semibold text-[#8B887E] uppercase tracking-widest">Sprint 速度（已完成 / 總任務）</div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-[#C96442] opacity-80" />
                <span className="text-[#5A574E]">已完成</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-[#F1EEE6]" />
                <span className="text-[#8B887E]">總任務</span>
              </span>
            </div>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 240 }}>
            {grids.map(pv => {
              const tv = Math.round((pv / 100) * maxTasks);
              const y = PT + cH - (pv / 100) * cH;
              return (
                <g key={pv}>
                  <line x1={PL} y1={y} x2={W-PR} y2={y}
                    stroke={pv === 0 ? '#D8D3C5' : '#E9E5DA'} strokeWidth={pv === 0 ? 1.5 : 1} />
                  <text x={PL-5} y={y+4} textAnchor="end" fontSize="10" fill="#B5B2A6">{tv}</text>
                </g>
              );
            })}
            {data.map((d, i) => {
              const cx = xPos(i);
              const totalH = maxTasks > 0 ? (d.taskCount / maxTasks) * cH : 0;
              const doneH  = maxTasks > 0 ? (d.doneCount  / maxTasks) * cH : 0;
              const bx = cx - barW / 2;
              const doneLabelY  = Math.max(PT + 12, PT + cH - doneH - 6);
              const totalLabelY = Math.max(PT + 3,  PT + cH - totalH - 6);
              const showTotalLabel = d.taskCount !== d.doneCount && d.taskCount > 0 && (doneLabelY - totalLabelY) >= 14;
              return (
                <g key={i}>
                  <rect x={bx} y={PT+cH-totalH} width={barW} height={totalH} rx="4" fill="#F1EEE6" opacity="0.9" />
                  {doneH > 0 && (
                    <rect x={bx} y={PT+cH-doneH} width={barW} height={doneH} rx="4" fill="#C96442" opacity="0.85" />
                  )}
                  {d.doneCount > 0 && (
                    <text x={cx} y={doneLabelY} textAnchor="middle" fontSize="10" fill="#C96442" fontWeight="bold">{d.doneCount}</text>
                  )}
                  {showTotalLabel && (
                    <text x={cx} y={totalLabelY} textAnchor="middle" fontSize="9" fill="#B5B2A6">{d.taskCount}</text>
                  )}
                  <text x={cx} y={PT + cH + 16} textAnchor="middle" fontSize="11" fill="#8B887E" fontWeight="bold">{d.label}</text>
                  {d.startDate && (
                    <text x={cx} y={PT + cH + 29} textAnchor="middle" fontSize="9" fill="#B5B2A6">{fmtDate(d.startDate)}</text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* 各 Sprint 關鍵數據表 */}
      <div className="px-6 pb-5 pt-2">
        <div className="text-[10px] font-semibold text-[#8B887E] uppercase tracking-widest mb-2">各 Sprint 關鍵數據</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#F1EEE6] text-[#5A574E]">
                <th className="px-3 py-2 text-left font-semibold rounded-tl-lg whitespace-nowrap">Sprint</th>
                <th className="px-3 py-2 text-left font-semibold">專案名稱</th>
                <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">開始日期</th>
                <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">結束日期</th>
                <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">狀態</th>
                <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">任務完成</th>
                <th className="px-3 py-2 text-center font-semibold rounded-tr-lg whitespace-nowrap">完成率</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={d.label} className={i % 2 === 0 ? 'bg-[#FAF9F5]' : 'bg-white'}>
                  <td className="px-3 py-2 font-semibold text-[#C96442] whitespace-nowrap">{d.label}</td>
                  <td className="px-3 py-2 text-[#1F1D17]">{d.fullName}</td>
                  <td className="px-3 py-2 text-center text-[#8B887E] whitespace-nowrap">{d.startDate ? fmtDate(d.startDate) : '—'}</td>
                  <td className="px-3 py-2 text-center text-[#8B887E] whitespace-nowrap">{d.endDate ? fmtDate(d.endDate) : '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                      d.isCompleted
                        ? 'bg-[#DDE6D9] text-[#4F7E5C] border-[#4F7E5C]/30'
                        : d.taskCount > 0
                          ? 'bg-[#F0E4C9] text-[#B8893A] border-[#B8893A]/30'
                          : 'bg-[#F1EEE6] text-[#8B887E] border-[#E9E5DA]'
                    }`}>
                      {d.isCompleted ? '已完成' : d.taskCount > 0 ? '進行中' : '待開始'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-[#5A574E] font-semibold whitespace-nowrap">
                    {d.taskCount > 0 ? `${d.doneCount} / ${d.taskCount}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    {d.taskCount > 0 ? (
                      <div className="flex items-center gap-1.5 justify-center">
                        <div className="w-14 bg-[#F1EEE6] rounded-full h-1 overflow-hidden">
                          <div className="h-full rounded-full bg-[#C96442]" style={{ width: `${d.completionRate}%` }} />
                        </div>
                        <span className="font-semibold text-[#C96442] w-7 text-right">{d.completionRate}%</span>
                      </div>
                    ) : <span className="text-[#B5B2A6]">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
// ── 趨勢圖元件 end ───────────────────────────────────────

// ── Sprint 執行進度趨勢圖 ─────────────────────────────────
const PROGRESS_COLORS = ['#C96442', '#4F7E5C', '#B8893A', '#467386', '#8B5A2B', '#5A574E', '#B8543C', '#8B887E'];

function parseDurationToDays(duration: string | undefined): number | null {
  if (!duration) return null;
  if (duration === '30d') return 30;
  const n = Number(duration);
  if (Number.isFinite(n) && n > 0) return n * 7;
  return null;
}

function getSprintTotalDays(sprint: SprintDoc): number {
  const fromDuration = parseDurationToDays(sprint.planning?.duration);
  if (fromDuration !== null) return fromDuration;
  return sprint.daily?.completedDays?.length || 1;
}

function SprintProgressChart({ sprints }: { sprints: SprintDoc[] }) {
  const sprintsWithData = sprints.filter(s =>
    Array.isArray(s.daily?.completedDays) && (s.daily!.completedDays!.length > 0)
  );
  if (sprintsWithData.length === 0) return null;

  const W = 720, H = 260;
  const PL = 48, PR = 16, PT = 22, PB = 58;
  const cW = W - PL - PR;
  const cH = H - PT - PB;

  const sprintTotals = sprintsWithData.map(s => getSprintTotalDays(s));
  const maxTotalDays = Math.max(...sprintTotals);

  const xOf = (day: number) => PL + (day / maxTotalDays) * cW;
  const yOf = (pct: number) => PT + cH - (pct / 100) * cH;

  const xInterval = maxTotalDays <= 14 ? 2 : maxTotalDays <= 30 ? 5 : 7;
  const xTicks: number[] = [];
  for (let d = 0; d <= maxTotalDays; d += xInterval) xTicks.push(d);
  if (xTicks[xTicks.length - 1] !== maxTotalDays) xTicks.push(maxTotalDays);

  const yGrids = [0, 25, 50, 75, 100];

  return (
    <section className="bg-white border border-[#E9E5DA] rounded-xl overflow-hidden">
      <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-5 py-3 flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-[#4F7E5C] flex items-center justify-center flex-shrink-0">
          <TrendingUp size={13} strokeWidth={2} className="text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold text-[#1F1D17]">Sprint 執行進度趨勢</div>
          <div className="text-[10px] text-[#8B887E]">每個 Sprint 的每日累積打卡率，虛線為各 Sprint 理想進度</div>
        </div>
      </div>

      <div className="px-6 pt-5 pb-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 240 }}>
          {yGrids.map(v => (
            <g key={v}>
              <line x1={PL} y1={yOf(v)} x2={W - PR} y2={yOf(v)}
                stroke={v === 0 ? '#D8D3C5' : '#E9E5DA'} strokeWidth={v === 0 ? 1.5 : 1} />
              <text x={PL - 5} y={yOf(v) + 4} textAnchor="end" fontSize="10" fill="#B5B2A6">{v}%</text>
            </g>
          ))}

          {xTicks.map(d => (
            <g key={`vg-${d}`}>
              <line x1={xOf(d)} y1={PT} x2={xOf(d)} y2={PT + cH}
                stroke={d === 0 || d === maxTotalDays ? '#D8D3C5' : '#E9E5DA'} strokeWidth="1" />
              <text x={xOf(d)} y={PT + cH + 14} textAnchor="middle" fontSize="10" fill="#B5B2A6">
                {d === 0 ? '0' : `第${d}天`}
              </text>
            </g>
          ))}

          <text x={PL + cW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#B5B2A6">執行天數</text>

          {sprintsWithData.map((sprint, si) => {
            const totalDays = sprintTotals[si];
            const color = PROGRESS_COLORS[si % PROGRESS_COLORS.length];
            return (
              <line key={`ideal-${sprint.id}`}
                x1={xOf(0)} y1={yOf(0)} x2={xOf(totalDays)} y2={yOf(100)}
                stroke={color} strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.3" />
            );
          })}

          {sprintsWithData.map((sprint, si) => {
            const completedDays = sprint.daily!.completedDays!;
            const totalDays = sprintTotals[si];
            const color = PROGRESS_COLORS[si % PROGRESS_COLORS.length];

            const points: { x: number; y: number }[] = [{ x: 0, y: 0 }];
            let cumul = 0;
            for (let i = 0; i < completedDays.length && i < totalDays; i++) {
              if (completedDays[i]) cumul++;
              points.push({ x: i + 1, y: (cumul / totalDays) * 100 });
            }

            const linePath = points.map((p, pi) =>
              `${pi === 0 ? 'M' : 'L'}${xOf(p.x).toFixed(1)},${yOf(p.y).toFixed(1)}`
            ).join(' ');

            const last = points[points.length - 1];
            const globalIdx = sprints.indexOf(sprint);
            const labelY = yOf(last.y) - 10 < PT + 10 ? yOf(last.y) + 16 : yOf(last.y) - 10;

            return (
              <g key={sprint.id}>
                <path d={linePath} fill="none" stroke={color} strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={xOf(last.x)} cy={yOf(last.y)} r="4.5"
                  fill="white" stroke={color} strokeWidth="2.2" />
                <text x={xOf(last.x)} y={labelY}
                  textAnchor="middle" fontSize="10" fill={color} fontWeight="bold"
                  stroke="white" strokeWidth="3" paintOrder="stroke fill">
                  S{globalIdx + 1} {Math.round(last.y)}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 圖例 */}
      <div className="px-6 pb-5">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="flex items-center gap-1.5 text-xs text-[#B5B2A6] mr-1">
            <svg width="20" height="8" viewBox="0 0 20 8">
              <line x1="0" y1="4" x2="20" y2="4" stroke="#D8D3C5" strokeWidth="1.5" strokeDasharray="5 3" />
            </svg>
            理想進度
          </span>
          {sprintsWithData.map((sprint, si) => {
            const color = PROGRESS_COLORS[si % PROGRESS_COLORS.length];
            const totalDays = sprintTotals[si];
            const completedDays = sprint.daily!.completedDays!;
            const checked = completedDays.filter(Boolean).length;
            const globalIdx = sprints.indexOf(sprint);
            const name = sprint.name || sprint.planning?.sprintName || `Sprint ${globalIdx + 1}`;
            return (
              <span key={sprint.id} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-[#F6F3EB] border border-[#E9E5DA]" style={{ color }}>
                <svg width="16" height="8" viewBox="0 0 16 8">
                  <line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="2" />
                  <circle cx="8" cy="4" r="2.5" fill="white" stroke={color} strokeWidth="2" />
                </svg>
                <span>S{globalIdx + 1}</span>
                <span className="text-[#8B887E] font-normal max-w-[100px] truncate">{name.length > 12 ? name.slice(0, 12) + '…' : name}</span>
                <span className="text-[#B5B2A6] font-normal">{checked}/{totalDays}天</span>
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
// ── Sprint 執行進度趨勢圖 end ─────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  'completed': '已完成', 'in-progress': '進行中', 'pending': '待開始',
};
const STATUS_BADGE: Record<string, string> = {
  'completed': 'bg-[#DDE6D9] text-[#4F7E5C] border-[#4F7E5C]/30',
  'in-progress': 'bg-[#F0E4C9] text-[#B8893A] border-[#B8893A]/30',
  'pending': 'bg-[#F1EEE6] text-[#8B887E] border-[#E9E5DA]',
};
const STATUS_NODE_BG: Record<string, string> = {
  'completed': '#4F7E5C',
  'in-progress': '#C96442',
  'pending': '#B5B2A6',
};

function getSprintYear(sprint: SprintDoc): string {
  if (sprint.planning?.startDate) {
    const m = sprint.planning.startDate.match(/^(\d{4})/);
    if (m) return m[1];
  }
  return new Date(sprint.createdAt || Date.now()).getFullYear().toString();
}

function getSprintDate(sprint: SprintDoc): string {
  if (sprint.planning?.startDate) return sprint.planning.startDate;
  if (sprint.createdAt) {
    return new Date(sprint.createdAt).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
  }
  return '—';
}

export default function ReportPage() {
  const { user, loading: authLoading } = useAuth();
  const [sprints, setSprints] = useState<SprintDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    const fetch = async () => {
      const ref = collection(db, 'sprints');
      const q = query(ref, where('ownerId', '==', user.uid));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as SprintDoc));
      data.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setSprints(data);
      const ids = new Set(data.filter(s =>
        s.planning?.goal || (s.backlog?.tasks || []).length > 0 || s.review?.demo || s.retrospective?.actionItems
      ).map(s => s.id));
      setExpandedIds(ids);
      setLoading(false);
    };
    fetch().catch(() => setLoading(false));
  }, [user, authLoading]);

  const filteredSprints = React.useMemo(() => {
    if (!filterFrom && !filterTo) return sprints;
    return sprints.filter(s => {
      const dateStr = s.planning?.startDate
        ? s.planning.startDate.slice(0, 10)
        : new Date(s.createdAt || 0).toISOString().split('T')[0];
      if (filterFrom && dateStr < filterFrom) return false;
      if (filterTo   && dateStr > filterTo)   return false;
      return true;
    });
  }, [sprints, filterFrom, filterTo]);

  const isFiltered = filterFrom || filterTo;

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const metrics = React.useMemo(() => {
    let totalTasks = 0, doneTasks = 0, totalPbis = 0, acceptedTasks = 0;
    const contributors = new Set<string>();
    let totalEdits = 0;
    for (const s of filteredSprints) {
      const allItems = s.backlog?.tasks || [];
      const pbis = allItems.filter((t: Task) => t.status === 'pbi');
      const pbiIdSet = new Set(pbis.map((t: Task) => t.id));
      const tasks = allItems.filter((t: Task) => t.type === 'task' && t.pbiId && pbiIdSet.has(t.pbiId));
      totalTasks += tasks.length;
      doneTasks += tasks.filter((t: Task) => t.status === 'done').length;
      totalPbis += pbis.length;
      acceptedTasks += pbis.filter((t: Task) => !!t.acceptedBy).length;
      getDevNames(s.planning).forEach(n => contributors.add(n));
      if (s.planning?.po) contributors.add(s.planning.po);
      if (s.planning?.sm) contributors.add(s.planning.sm);
      totalEdits += s.editHistory?.length || 0;
    }
    const dates = filteredSprints
      .map(s => s.planning?.startDate || '')
      .filter(Boolean)
      .sort();
    const periodFrom = filterFrom || dates[0] || '';
    const periodTo   = filterTo   || dates[dates.length - 1] || '';

    return {
      total: filteredSprints.length,
      completed: filteredSprints.filter(s => inferStatus(s) === 'completed').length,
      totalTasks, doneTasks, totalPbis, acceptedTasks,
      completionRate: pct(doneTasks, totalTasks),
      acceptanceRate: pct(acceptedTasks, totalPbis),
      contributors: contributors.size,
      totalEdits,
      periodFrom,
      periodTo,
    };
  }, [filteredSprints, filterFrom, filterTo]);

  const chartData: ChartPoint[] = React.useMemo(() =>
    filteredSprints.map((s, i) => {
      const allItems = s.backlog?.tasks || [];
      const pbis = allItems.filter((t: Task) => t.status === 'pbi');
      const pbiIdSet = new Set(pbis.map((t: Task) => t.id));
      const tasks = allItems.filter((t: Task) => t.type === 'task' && t.pbiId && pbiIdSet.has(t.pbiId));
      const done = tasks.filter((t: Task) => t.status === 'done').length;
      const accepted = pbis.filter((t: Task) => !!t.acceptedBy).length;
      const startDate = s.planning?.startDate || '';
      const totalDays = parseDurationToDays(s.planning?.duration) ?? (s.daily?.completedDays?.length || 0);
      let endDate = '';
      if (startDate && totalDays > 0) {
        const ed = new Date(startDate);
        ed.setDate(ed.getDate() + totalDays - 1);
        endDate = ed.toISOString().slice(0, 10);
      }
      return {
        label: `S${i + 1}`,
        fullName: s.name || s.planning?.sprintName || `Sprint ${i + 1}`,
        completionRate: pct(done, tasks.length),
        acceptanceRate: pct(accepted, pbis.length),
        taskCount: tasks.length,
        doneCount: done,
        startDate,
        endDate,
        isCompleted: inferStatus(s) === 'completed',
      };
    })
  , [filteredSprints]);

  const sprintsByYear = React.useMemo(() => {
    const map: Record<string, SprintDoc[]> = {};
    for (const s of filteredSprints) {
      const year = getSprintYear(s);
      if (!map[year]) map[year] = [];
      map[year].push(s);
    }
    return map;
  }, [filteredSprints]);
  const years = Object.keys(sprintsByYear).sort();

  if (loading || authLoading) {
    return (
      <main className="min-h-screen bg-[#FAF9F5] flex items-center justify-center font-sans">
        <div className="text-[#8B887E] text-sm">載入成效資料中...</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#FAF9F5] flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="text-xl font-semibold text-[#1F1D17]">請先登入</div>
          <Link href="/" className="text-[#C96442] text-sm hover:underline">返回首頁</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF9F5] font-sans text-[#1F1D17] print:bg-white">
      <div className="w-full p-4 md:p-8 space-y-6">

        {/* 操作列 */}
        <div className="space-y-3 print:hidden">
          <div className="flex justify-between items-center gap-2 flex-wrap">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[#5A574E] bg-white px-4 py-2 rounded-[9px] border border-[#E9E5DA] hover:shadow-sm hover:-translate-y-[1px] transition-all duration-150">
              <Home size={14} strokeWidth={1.75} /> 返回專案大廳
            </Link>
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#1F1D17] px-4 py-2 rounded-[9px] hover:bg-[#3D3B35] hover:shadow-sm hover:-translate-y-[1px] transition-all duration-150">
              <Printer size={14} strokeWidth={1.75} /> 列印 / 匯出 PDF
            </button>
          </div>
          {/* 日期篩選列 */}
          <div className="bg-white border border-[#E9E5DA] rounded-xl px-5 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-[#8B887E] flex items-center gap-1.5 whitespace-nowrap">
              <Calendar size={13} strokeWidth={1.75} /> 日期篩選
            </span>
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <input
                type="date"
                value={filterFrom}
                onChange={e => setFilterFrom(e.target.value)}
                className="text-sm border border-[#E9E5DA] rounded-[9px] px-3 py-1.5 bg-[#FAF9F5] text-[#1F1D17] focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] transition-colors"
              />
              <span className="text-[#B5B2A6]">—</span>
              <input
                type="date"
                value={filterTo}
                onChange={e => setFilterTo(e.target.value)}
                className="text-sm border border-[#E9E5DA] rounded-[9px] px-3 py-1.5 bg-[#FAF9F5] text-[#1F1D17] focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] transition-colors"
              />
              {isFiltered && (
                <button
                  onClick={() => { setFilterFrom(''); setFilterTo(''); }}
                  className="inline-flex items-center gap-1 text-xs text-[#B8543C] hover:text-[#7A3520] transition-colors whitespace-nowrap"
                >
                  <X size={12} strokeWidth={2} /> 清除篩選
                </button>
              )}
            </div>
            <div className="text-xs text-[#8B887E] whitespace-nowrap">
              {isFiltered
                ? `顯示 ${filteredSprints.length} / ${sprints.length} 個 Sprint`
                : `共 ${sprints.length} 個 Sprint`}
            </div>
          </div>
        </div>

        {/* 封面標題 Hero */}
        <section className="bg-[#1F1D17] text-white rounded-xl px-6 py-8 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-[10px] font-semibold opacity-50 mb-3 tracking-widest uppercase">Scrum Management Report · {today}</div>
            <h1 className="text-2xl md:text-4xl font-semibold leading-tight mb-2">
              敏捷開發 成效歷程報告
            </h1>
            <div className="flex items-center gap-3 flex-wrap mb-6">
              <div className="text-sm opacity-60">{user.displayName || user.email} · 資訊部門</div>
              {metrics.periodFrom && (
                <div className="inline-flex items-center gap-1.5 bg-white/10 text-white/80 text-xs px-3 py-1 rounded-lg">
                  <Calendar size={11} strokeWidth={1.75} />
                  <span>{metrics.periodFrom}</span>
                  <span className="opacity-50">–</span>
                  <span>{metrics.periodTo || today}</span>
                </div>
              )}
            </div>

            {/* KPI strip */}
            <div className="flex items-stretch divide-x divide-white/10 bg-white/6 rounded-lg overflow-hidden border border-white/10 w-fit">
              {[
                { label: '執行 Sprint', value: metrics.total, unit: '個' },
                { label: '已完成', value: metrics.completed, unit: '個' },
                { label: '任務完成率', value: metrics.completionRate, unit: '%' },
                { label: '參與成員', value: metrics.contributors, unit: '人' },
              ].map(m => (
                <div key={m.label} className="px-5 py-3 text-center">
                  <div className="text-2xl font-semibold leading-none">
                    {m.value}<span className="text-xs ml-0.5 opacity-60">{m.unit}</span>
                  </div>
                  <div className="text-[10px] opacity-50 mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 趨勢圖 */}
        <TrendCharts data={chartData} completedCount={metrics.completed} totalCount={metrics.total} />

        {/* Sprint 執行進度趨勢 */}
        <SprintProgressChart sprints={filteredSprints} />

        {/* 無資料提示 */}
        {filteredSprints.length === 0 && (
          <section className="bg-white border border-[#E9E5DA] rounded-xl p-10 text-center">
            <div className="text-base font-semibold text-[#5A574E] mb-2">尚無 Sprint 資料</div>
            <div className="text-sm text-[#8B887E] mb-4">
              {isFiltered ? '目前篩選條件下沒有符合的 Sprint，請調整日期範圍。' : '請先建立並執行 Sprint，系統將自動彙整所有實際數據。'}
            </div>
            {!isFiltered && <Link href="/" className="text-sm text-[#C96442] hover:underline">前往建立 Sprint</Link>}
          </section>
        )}

        {/* ── 年度歷程表（主幹） ── */}
        {years.map(year => (
          <section key={year}>
            {/* 年份標題 */}
            <div className="flex items-center gap-4 mb-5">
              <div className="text-2xl font-semibold text-[#1F1D17] leading-none">{year}</div>
              <div className="flex-1 h-px bg-[#E9E5DA]" />
              <div className="text-xs text-[#8B887E]">{sprintsByYear[year].length} 個 Sprint</div>
            </div>

            {/* 時間軸 */}
            <div className="relative">
              {/* 垂直主線 */}
              <div className="absolute left-[15px] top-4 bottom-4 w-px bg-[#E9E5DA] print:bg-[#D8D3C5]" />

              <div className="space-y-4">
                {sprintsByYear[year].map((sprint, idx) => {
                  const allItems = sprint.backlog?.tasks || [];
                  const spPbis = allItems.filter((t: Task) => t.status === 'pbi');
                  const spPbiIdSet = new Set(spPbis.map((t: Task) => t.id));
                  const tasks = allItems.filter((t: Task) => t.type === 'task' && t.pbiId && spPbiIdSet.has(t.pbiId));
                  const done = tasks.filter((t: Task) => t.status === 'done').length;
                  const accepted = spPbis.filter((t: Task) => !!t.acceptedBy).length;
                  const devNames = getDevNames(sprint.planning);
                  const statusKey = inferStatus(sprint);
                  const isExpanded = expandedIds.has(sprint.id);
                  const hasDetail = !!(sprint.planning?.goal || allItems.length > 0 || sprint.review?.demo || sprint.retrospective?.actionItems);

                  return (
                    <div key={sprint.id} className="flex gap-3">
                      {/* 時間軸節點 */}
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shadow-sm z-10"
                          style={{ backgroundColor: STATUS_NODE_BG[statusKey] }}>
                          {statusKey === 'completed' ? <CheckCircle2 size={14} strokeWidth={2} /> : idx + 1}
                        </div>
                      </div>

                      {/* Sprint 卡片 */}
                      <div className="flex-1 min-w-0 bg-white border border-[#E9E5DA] rounded-xl overflow-hidden mb-1 hover:shadow-sm transition-all duration-150">
                        {/* 卡片標題列 */}
                        <button
                          className="w-full px-5 py-4 flex items-start gap-3 text-left hover:bg-[#FAF9F5] transition-colors"
                          onClick={() => hasDetail && toggleExpand(sprint.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-[#1F1D17] text-sm">
                                {sprint.name || sprint.planning?.sprintName || '未命名 Sprint'}
                              </span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${STATUS_BADGE[statusKey]}`}>
                                {STATUS_LABEL[statusKey]}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              {sprint.planning?.startDate && (
                                <span className="text-xs text-[#8B887E] flex items-center gap-1">
                                  <Calendar size={11} strokeWidth={1.75} />
                                  {getSprintDate(sprint)}{sprint.planning.duration ? ` · ${sprint.planning.duration}週` : ''}
                                </span>
                              )}
                              {tasks.length > 0 && (
                                <span className="text-xs text-[#8B887E] flex items-center gap-1">
                                  <FileText size={11} strokeWidth={1.75} />
                                  {tasks.length} 個任務 · 完成 {pct(done, tasks.length)}%
                                </span>
                              )}
                              {(sprint.planning?.po || sprint.planning?.sm) && (
                                <span className="text-xs text-[#8B887E] flex items-center gap-1">
                                  <User size={11} strokeWidth={1.75} />
                                  {[sprint.planning.po, sprint.planning.sm].filter(Boolean).join(' / ')}
                                </span>
                              )}
                            </div>
                          </div>
                          {hasDetail && (
                            <span className="text-[#B5B2A6] flex-shrink-0 mt-1">
                              {isExpanded ? <ChevronUp size={16} strokeWidth={1.75} /> : <ChevronDown size={16} strokeWidth={1.75} />}
                            </span>
                          )}
                        </button>

                        {/* 展開內容 */}
                        {isExpanded && (
                          <div className="border-t border-[#E9E5DA] bg-[#FAF9F5] px-5 py-5 space-y-5">

                            {/* Sprint Goal */}
                            {sprint.planning?.goal && (
                              <div>
                                <div className="text-[10px] uppercase tracking-widest text-[#8B887E] mb-2 flex items-center gap-1.5 font-semibold">
                                  <Target size={11} strokeWidth={2} /> Sprint Goal
                                </div>
                                <p className="text-sm text-[#1F1D17] bg-white px-4 py-3 rounded-lg border border-[#E9E5DA] leading-relaxed">
                                  {sprint.planning.goal}
                                </p>
                              </div>
                            )}

                            <div className="grid md:grid-cols-2 gap-5">
                              {/* 執行團隊 */}
                              {(sprint.planning?.po || sprint.planning?.sm || devNames.length > 0) && (
                                <div>
                                  <div className="text-[10px] uppercase tracking-widest text-[#8B887E] mb-2 flex items-center gap-1.5 font-semibold">
                                    <Users size={11} strokeWidth={2} /> 執行團隊
                                  </div>
                                  <div className="space-y-1 text-sm">
                                    {sprint.planning?.po && (
                                      <div className="flex gap-2">
                                        <span className="text-[#8B887E] w-24 flex-shrink-0 text-xs">Product Owner</span>
                                        <span className="font-medium text-[#1F1D17] text-xs">{sprint.planning.po}</span>
                                      </div>
                                    )}
                                    {sprint.planning?.sm && (
                                      <div className="flex gap-2">
                                        <span className="text-[#8B887E] w-24 flex-shrink-0 text-xs">Scrum Master</span>
                                        <span className="font-medium text-[#1F1D17] text-xs">{sprint.planning.sm}</span>
                                      </div>
                                    )}
                                    {devNames.length > 0 && (
                                      <div className="flex gap-2">
                                        <span className="text-[#8B887E] w-24 flex-shrink-0 text-xs">開發團隊</span>
                                        <span className="font-medium text-[#1F1D17] text-xs">{devNames.join('、')}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* 任務數據 */}
                              {tasks.length > 0 && (
                                <div>
                                  <div className="text-[10px] uppercase tracking-widest text-[#8B887E] mb-2 flex items-center gap-1.5 font-semibold">
                                    <BarChart2 size={11} strokeWidth={2} /> 執行數據
                                  </div>
                                  <div className="space-y-2">
                                    <div>
                                      <div className="flex justify-between text-xs mb-1">
                                        <span className="text-[#5A574E]">任務完成率</span>
                                        <span className="text-[#8B887E]">{done} / {tasks.length} 筆</span>
                                      </div>
                                      <MiniBar value={done} max={tasks.length} color="#C96442" />
                                    </div>
                                    {accepted > 0 && (
                                      <div>
                                        <div className="flex justify-between text-xs mb-1">
                                          <span className="text-[#5A574E]">PBI 驗收率</span>
                                          <span className="text-[#8B887E]">{accepted} / {tasks.length} 筆</span>
                                        </div>
                                        <MiniBar value={accepted} max={tasks.length} color="#4F7E5C" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* PBI 清單 */}
                            {sprint.planning?.pbis && sprint.planning.pbis.length > 0 && (
                              <div>
                                <div className="text-[10px] uppercase tracking-widest text-[#8B887E] mb-2 flex items-center gap-1.5 font-semibold">
                                  <ClipboardList size={11} strokeWidth={2} /> PBI 清單（{sprint.planning.pbis.length} 項）
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {sprint.planning.pbis.map((pbi, i) => (
                                    <span key={pbi.id || i} className="text-xs bg-[#F6F3EB] border border-[#E9E5DA] px-3 py-1 rounded-lg text-[#5A574E]">
                                      {pbi.title}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 任務明細 */}
                            {tasks.length > 0 && (
                              <div>
                                <div className="text-[10px] uppercase tracking-widest text-[#8B887E] mb-2 flex items-center gap-1.5 font-semibold">
                                  <ClipboardList size={11} strokeWidth={2} /> 任務明細（{done}/{tasks.length} 完成）
                                </div>
                                <div className="space-y-2">
                                  {spPbis.filter(pbi => tasks.some(t => t.pbiId === pbi.id)).map(pbi => {
                                    const pbiTasks = tasks.filter(t => t.pbiId === pbi.id);
                                    const pbiDone = pbiTasks.filter(t => t.status === 'done').length;
                                    return (
                                      <div key={pbi.id} className="border border-[#E9E5DA] rounded-lg overflow-hidden bg-white">
                                        <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-3 py-2 flex items-center gap-2">
                                          <span className="text-xs font-semibold text-[#1F1D17] flex-1 min-w-0 truncate">{pbi.title || '未命名 PBI'}</span>
                                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg whitespace-nowrap flex-shrink-0 ${pbiDone === pbiTasks.length ? 'bg-[#DDE6D9] text-[#4F7E5C]' : 'bg-[#F1EEE6] text-[#8B887E]'}`}>
                                            {pbiDone}/{pbiTasks.length} 完成
                                          </span>
                                        </div>
                                        <div className="divide-y divide-[#F1EEE6]">
                                          {pbiTasks.map(task => (
                                            <div key={task.id} className="px-3 py-2 flex items-center gap-2 flex-wrap">
                                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                                task.status === 'done' ? 'bg-[#4F7E5C]' : task.status === 'doing' ? 'bg-[#C96442]' : 'bg-[#B5B2A6]'
                                              }`} />
                                              <span className={`text-xs flex-1 min-w-[100px] ${task.status === 'done' ? 'text-[#8B887E] line-through' : 'text-[#1F1D17]'}`}>
                                                {task.title || '未命名任務'}
                                              </span>
                                              {task.role && (
                                                <span className="text-[10px] bg-[#F1EEE6] text-[#5A574E] border border-[#E9E5DA] px-2 py-0.5 rounded-lg whitespace-nowrap">
                                                  {task.role}
                                                </span>
                                              )}
                                              {task.time && (
                                                <span className="text-[10px] bg-[#F5E4DA] text-[#7A3520] border border-[#F5E4DA] px-2 py-0.5 rounded-lg flex items-center gap-1 whitespace-nowrap">
                                                  <Clock size={9} strokeWidth={2} /> {task.time}
                                                </span>
                                              )}
                                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg whitespace-nowrap ${
                                                task.status === 'done' ? 'bg-[#DDE6D9] text-[#4F7E5C]' :
                                                task.status === 'doing' ? 'bg-[#F0E4C9] text-[#B8893A]' : 'bg-[#F1EEE6] text-[#8B887E]'
                                              }`}>
                                                {task.status === 'done' ? '已完成' : task.status === 'doing' ? '進行中' : '待開始'}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {/* 無 PBI 的任務 */}
                                  {(() => {
                                    const orphans = tasks.filter(t => !spPbis.some(p => p.id === t.pbiId));
                                    if (!orphans.length) return null;
                                    return (
                                      <div className="border border-[#E9E5DA] rounded-lg overflow-hidden bg-white">
                                        <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-3 py-2">
                                          <span className="text-xs font-semibold text-[#8B887E]">其他任務</span>
                                        </div>
                                        <div className="divide-y divide-[#F1EEE6]">
                                          {orphans.map(task => (
                                            <div key={task.id} className="px-3 py-2 flex items-center gap-2 flex-wrap">
                                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                                task.status === 'done' ? 'bg-[#4F7E5C]' : task.status === 'doing' ? 'bg-[#C96442]' : 'bg-[#B5B2A6]'
                                              }`} />
                                              <span className={`text-xs flex-1 min-w-[100px] ${task.status === 'done' ? 'text-[#8B887E] line-through' : 'text-[#1F1D17]'}`}>
                                                {task.title || '未命名任務'}
                                              </span>
                                              {task.role && (
                                                <span className="text-[10px] bg-[#F1EEE6] text-[#5A574E] border border-[#E9E5DA] px-2 py-0.5 rounded-lg whitespace-nowrap">
                                                  {task.role}
                                                </span>
                                              )}
                                              {task.time && (
                                                <span className="text-[10px] bg-[#F5E4DA] text-[#7A3520] border border-[#F5E4DA] px-2 py-0.5 rounded-lg flex items-center gap-1 whitespace-nowrap">
                                                  <Clock size={9} strokeWidth={2} /> {task.time}
                                                </span>
                                              )}
                                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg whitespace-nowrap ${
                                                task.status === 'done' ? 'bg-[#DDE6D9] text-[#4F7E5C]' :
                                                task.status === 'doing' ? 'bg-[#F0E4C9] text-[#B8893A]' : 'bg-[#F1EEE6] text-[#8B887E]'
                                              }`}>
                                                {task.status === 'done' ? '已完成' : task.status === 'doing' ? '進行中' : '待開始'}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            )}

                            {/* Sprint Review */}
                            {(sprint.review?.opening || sprint.review?.demo || sprint.review?.future) && (
                              <div>
                                <div className="text-[10px] uppercase tracking-widest text-[#8B887E] mb-2 flex items-center gap-1.5 font-semibold">
                                  <Target size={11} strokeWidth={2} /> Sprint Review 成果
                                </div>
                                <div className="space-y-2">
                                  {sprint.review.opening && (
                                    <div>
                                      <div className="text-[10px] text-[#8B887E] font-semibold uppercase mb-1">開場總結</div>
                                      <p className="text-xs text-[#5A574E] bg-white px-3 py-2.5 rounded-lg border border-[#E9E5DA] whitespace-pre-wrap leading-relaxed">{sprint.review.opening}</p>
                                    </div>
                                  )}
                                  {sprint.review.demo && (
                                    <div>
                                      <div className="text-[10px] text-[#8B887E] font-semibold uppercase mb-1">成果演示</div>
                                      <p className="text-xs text-[#5A574E] bg-white px-3 py-2.5 rounded-lg border border-[#E9E5DA] whitespace-pre-wrap leading-relaxed">{sprint.review.demo}</p>
                                    </div>
                                  )}
                                  {sprint.review.future && (
                                    <div>
                                      <div className="text-[10px] text-[#8B887E] font-semibold uppercase mb-1">未來展望</div>
                                      <p className="text-xs text-[#5A574E] bg-white px-3 py-2.5 rounded-lg border border-[#E9E5DA] whitespace-pre-wrap leading-relaxed">{sprint.review.future}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Retrospective */}
                            {(sprint.retrospective?.keepStart || sprint.retrospective?.problemStop || sprint.retrospective?.actionItems) && (
                              <div>
                                <div className="text-[10px] uppercase tracking-widest text-[#8B887E] mb-2 flex items-center gap-1.5 font-semibold">
                                  <TrendingUp size={11} strokeWidth={2} /> Retrospective 改善記錄
                                </div>
                                <div className="grid md:grid-cols-3 gap-2">
                                  {sprint.retrospective.keepStart && (
                                    <div>
                                      <div className="text-[10px] font-semibold text-[#4F7E5C] mb-1.5 flex items-center gap-1">
                                        <Sprout size={11} strokeWidth={2} /> Keep / Start
                                      </div>
                                      <p className="text-xs text-[#5A574E] bg-[#DDE6D9] px-3 py-2.5 rounded-lg border border-[#4F7E5C]/20 whitespace-pre-wrap leading-relaxed">{sprint.retrospective.keepStart}</p>
                                    </div>
                                  )}
                                  {sprint.retrospective.problemStop && (
                                    <div>
                                      <div className="text-[10px] font-semibold text-[#B8543C] mb-1.5 flex items-center gap-1">
                                        <AlertTriangle size={11} strokeWidth={2} /> Problem / Stop
                                      </div>
                                      <p className="text-xs text-[#5A574E] bg-[#F0DDD3] px-3 py-2.5 rounded-lg border border-[#B8543C]/20 whitespace-pre-wrap leading-relaxed">{sprint.retrospective.problemStop}</p>
                                    </div>
                                  )}
                                  {sprint.retrospective.actionItems && (
                                    <div>
                                      <div className="text-[10px] font-semibold text-[#C96442] mb-1.5 flex items-center gap-1">
                                        <Zap size={11} strokeWidth={2} /> Action Items
                                      </div>
                                      <p className="text-xs text-[#5A574E] bg-[#F5E4DA] px-3 py-2.5 rounded-lg border border-[#C96442]/20 whitespace-pre-wrap leading-relaxed">{sprint.retrospective.actionItems}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ))}

        {/* 結語 */}
        {filteredSprints.length > 0 && (
          <section className="bg-[#1F1D17] text-white rounded-xl px-6 py-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={15} strokeWidth={1.75} className="opacity-60" />
              <h2 className="text-sm font-semibold opacity-90">數據說明</h2>
            </div>
            <p className="text-sm leading-relaxed opacity-60">
              以上所有內容均直接擷取自資訊部門的 Scrum 執行系統，未經任何人工修改。
              {metrics.total} 個 Sprint、{metrics.totalTasks} 筆工作項目、{metrics.contributors} 位成員參與、{metrics.totalEdits} 筆操作記錄。
              {metrics.completionRate > 0 && ` 整體任務完成率 ${metrics.completionRate}%`}{metrics.acceptanceRate > 0 && `、PBI 驗收率 ${metrics.acceptanceRate}%`}。
            </p>
            <div className="mt-4 text-xs opacity-30">報告產生時間：{today} · 資訊部門 Scrum 管理系統</div>
          </section>
        )}

      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          button { display: none !important; }
        }
      `}</style>
    </main>
  );
}
