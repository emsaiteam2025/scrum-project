"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface Task {
  id: string;
  title?: string;
  status?: string;
  type?: string;
  pbiId?: string;
  acceptedBy?: string;
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

// 自動推算 Sprint 狀態（完全與 page.tsx dashboards 計算邏輯一致）
function inferStatus(sprint: SprintDoc): 'pending' | 'in-progress' | 'completed' {
  if (sprint.sprintStatus) return sprint.sprintStatus;
  const allItems = sprint.backlog?.tasks || [];
  // 與主頁一致：PBI 是 status==='pbi' 的項目，只計算有效 task
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

function MiniBar({ value, max, color = '#5b755e' }: { value: number; max: number; color?: string }) {
  const p = pct(value, max);
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-[#e8d5b5] rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-black w-9 text-right" style={{ color }}>{p}%</span>
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

  // ── 日期時間軸階梯圖 ──
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

  // X 軸：留 5% 右側空間
  const dateSpan = (firstDateMs && lastDateMs && lastDateMs > firstDateMs)
    ? (lastDateMs - firstDateMs) * 1.08 : 86400000 * 30;
  const xFromDate = (ms: number) =>
    firstDateMs ? Math.min(W - PR - 2, PL + ((ms - firstDateMs) / dateSpan) * cW) : PL;

  // 累積步驟
  let cum = 0;
  const dateSteps = sortedByDate.map(d => {
    const before = cum;
    if (d.isCompleted) cum++;
    return { ...d, cumBefore: before, cumAfter: cum };
  });
  const maxCum = Math.max(cum, 1);
  const yCum = (v: number) => PT + cH - (v / maxCum) * cH;

  // 曲線路徑：每對相鄰點用水平切線貝茲曲線（S 形），保證不超出 Y 範圍
  const curvePoints = [
    { x: PL, y: PT + cH }, // y=0 起點
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

  // 群組式標籤定位：同群（x 距離 < 25px）的點水平分散，避免重疊
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

  // 週次 X 軸格線（每 7 天一格）
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

  // Y 格線（整數）
  const yGridStep = Math.ceil(maxCum / 4);
  const yGridVals: number[] = [];
  for (let v = 0; v <= maxCum; v += yGridStep) yGridVals.push(v);
  if (!yGridVals.includes(maxCum)) yGridVals.push(maxCum);


  // ── 長條圖（右） ──
  const xPos = (i: number) => n === 1 ? PL + cW / 2 : PL + (i / (n - 1)) * cW;
  const maxTasks = Math.max(...data.map(d => d.taskCount), 1);
  const barW = Math.min(38, (cW / Math.max(n, 1)) * 0.52);
  const grids = [0, 25, 50, 75, 100];

  return (
    <section className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-lg overflow-hidden">
      <div className="bg-[#5b755e] px-6 py-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-black text-white">📈 成效趨勢一覽</h2>
          <p className="text-xs text-white/70 mt-0.5">Scrum 導入後的專案完成速度與任務產出量</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-center bg-white/15 rounded-xl px-4 py-2">
            <div className="text-2xl font-black text-white leading-none">{totalCount}</div>
            <div className="text-[10px] text-white/70 mt-0.5">Sprint 總數</div>
          </div>
          <div className="text-center bg-white/15 rounded-xl px-4 py-2">
            <div className="text-2xl font-black text-white leading-none">{completedCount}</div>
            <div className="text-[10px] text-white/70 mt-0.5">已完成</div>
          </div>
          <div className="text-center bg-white/15 rounded-xl px-4 py-2">
            <div className="text-2xl font-black text-white leading-none">{totalCount - completedCount}</div>
            <div className="text-[10px] text-white/70 mt-0.5">進行中/待開始</div>
          </div>
        </div>
      </div>

      <div className="px-6 pt-4 grid md:grid-cols-2 gap-6">
        {/* 左：日期時間軸 × 累積完成 Sprint 數 */}
        <div>
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
            <div className="text-xs font-black text-[#5b755e] uppercase tracking-widest">專案完成時間軸</div>
            {monthsStr && completedCount > 0 && firstDateMs && lastDateMs && (
              <div className="text-xs bg-[#e8eedd] border border-[#8fb996] rounded-lg px-2.5 py-1 font-bold text-[#5b755e]">
                {fmtShort(firstDateMs)} 起，{monthsStr}完成 {completedCount} 個 Sprint
              </div>
            )}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 240 }}>
            <defs>
              <linearGradient id="rg-step" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5b755e" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#5b755e" stopOpacity="0.03" />
              </linearGradient>
            </defs>
            {/* Y 格線 */}
            {yGridVals.map(v => (
              <g key={v}>
                <line x1={PL} y1={yCum(v)} x2={W-PR} y2={yCum(v)}
                  stroke={v === 0 ? '#c8b99a' : '#ede9e1'} strokeWidth={v === 0 ? 1.5 : 1} />
                <text x={PL-5} y={yCum(v)+4} textAnchor="end" fontSize="10" fill="#c8b99a">{v}</text>
              </g>
            ))}
            {/* 週次垂直格線 */}
            {weekLabels.map((wl, i) => (
              <g key={i}>
                <line x1={wl.x} y1={PT} x2={wl.x} y2={PT+cH} stroke="#ede9e1" strokeWidth="1" strokeDasharray="3 3" />
                <text x={wl.x} y={PT+cH+14} textAnchor="middle" fontSize="9" fill="#b5a695">{wl.label}</text>
              </g>
            ))}
            {/* 面積填充 */}
            {hasDateData && <path d={smoothArea} fill="url(#rg-step)" />}
            {/* 曲線 */}
            {hasDateData && <path d={smoothPath} fill="none" stroke="#5b755e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
            {/* Sprint 節點 */}
            {dateSteps.map((s, i) => {
              const cx = xFromDate(s.dateMs!);
              const cy = yCum(s.cumAfter);
              return (
                <g key={i}>
                  {/* 擴大 hover 感應區 */}
                  <circle cx={cx} cy={cy} r="14" fill="transparent" style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)} />
                  <circle cx={cx} cy={cy} r={hoveredIdx === i ? 7 : 5}
                    fill={s.isCompleted ? '#5b755e' : 'white'}
                    stroke="#5b755e" strokeWidth="2.5"
                    style={{ transition: 'r 0.15s', pointerEvents: 'none' }} />
                  {s.isCompleted && labelMap.has(i) && (
                    <text x={labelMap.get(i)!.x} y={labelMap.get(i)!.y} textAnchor="middle" fontSize="10" fill="#5b755e" fontWeight="bold"
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
                    fill="white" stroke="#5b755e" strokeWidth="1.5"
                    style={{ filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.13))' }} />
                  <text x={tipX + 12} y={tipY + 18} fontSize="11" fill="#5b755e" fontWeight="bold">{s.label}　{name}</text>
                  <line x1={tipX + 12} y1={tipY + 25} x2={tipX + TW - 12} y2={tipY + 25} stroke="#e8d5b5" strokeWidth="1" />
                  <text x={tipX + 12} y={tipY + 40} fontSize="10" fill="#8a7f72">📅 開始：{s.startDate ? fmtDate(s.startDate) : '—'}</text>
                  <text x={tipX + 12} y={tipY + 56} fontSize="10" fill="#8a7f72">{s.isCompleted ? '✅ 已完成' : '🔄 進行中'}</text>
                  <text x={tipX + 12} y={tipY + 72} fontSize="10" fill="#5b755e" fontWeight="bold">累積完成 {s.cumAfter} 個 Sprint</text>
                </g>
              );
            })()}
          </svg>
        </div>

        {/* 右：Sprint 速度長條圖 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-black text-[#5b755e] uppercase tracking-widest">Sprint 速度（已完成 / 總任務）</div>
            {/* 圖例移至標題列右側 */}
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-[#5b755e] opacity-80"></span><span className="text-[#5b755e] font-bold">已完成</span></span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-[#d3cbbd] opacity-80"></span><span className="text-[#8a7f72] font-bold">總任務</span></span>
            </div>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 240 }}>
            {/* 格線 */}
            {grids.map(pv => {
              const tv = Math.round((pv / 100) * maxTasks);
              const y = PT + cH - (pv / 100) * cH;
              return (
                <g key={pv}>
                  <line x1={PL} y1={y} x2={W-PR} y2={y}
                    stroke={pv === 0 ? '#c8b99a' : '#ede9e1'} strokeWidth={pv === 0 ? 1.5 : 1} />
                  <text x={PL-5} y={y+4} textAnchor="end" fontSize="10" fill="#c8b99a">{tv}</text>
                </g>
              );
            })}
            {/* 長條 */}
            {data.map((d, i) => {
              const cx = xPos(i);
              const totalH = maxTasks > 0 ? (d.taskCount / maxTasks) * cH : 0;
              const doneH  = maxTasks > 0 ? (d.doneCount  / maxTasks) * cH : 0;
              const bx = cx - barW / 2;
              // 標籤 y 座標，夾住不超出圖表頂部
              const doneLabelY  = Math.max(PT + 12, PT + cH - doneH - 6);
              const totalLabelY = Math.max(PT + 3,  PT + cH - totalH - 6);
              // 只在兩標籤間距 >= 14px 時才顯示總數標籤
              const showTotalLabel = d.taskCount !== d.doneCount && d.taskCount > 0 && (doneLabelY - totalLabelY) >= 14;
              return (
                <g key={i}>
                  {/* 總任務（淺色底） */}
                  <rect x={bx} y={PT+cH-totalH} width={barW} height={totalH} rx="4" fill="#d3cbbd" opacity="0.55" />
                  {/* 已完成（深色） */}
                  {doneH > 0 && (
                    <rect x={bx} y={PT+cH-doneH} width={barW} height={doneH} rx="4" fill="#5b755e" opacity="0.82" />
                  )}
                  {/* 完成數字 */}
                  {d.doneCount > 0 && (
                    <text x={cx} y={doneLabelY} textAnchor="middle" fontSize="10" fill="#5b755e" fontWeight="bold">{d.doneCount}</text>
                  )}
                  {/* 總數字（間距足夠才顯示） */}
                  {showTotalLabel && (
                    <text x={cx} y={totalLabelY} textAnchor="middle" fontSize="9" fill="#b5a695">{d.taskCount}</text>
                  )}
                  <text x={cx} y={PT + cH + 16} textAnchor="middle" fontSize="11" fill="#8a7f72" fontWeight="bold">{d.label}</text>
                  {d.startDate && (
                    <text x={cx} y={PT + cH + 29} textAnchor="middle" fontSize="9" fill="#c8b99a">{fmtDate(d.startDate)}</text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Sprint 關鍵數據表 */}
      <div className="px-6 pb-5 pt-2">
        <div className="text-xs font-black text-[#5b755e] uppercase tracking-widest mb-2">各 Sprint 關鍵數據</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#5b755e] text-white">
                <th className="px-3 py-2 text-left font-bold rounded-tl-lg whitespace-nowrap">Sprint</th>
                <th className="px-3 py-2 text-left font-bold">專案名稱</th>
                <th className="px-3 py-2 text-center font-bold whitespace-nowrap">開始日期</th>
                <th className="px-3 py-2 text-center font-bold whitespace-nowrap">狀態</th>
                <th className="px-3 py-2 text-center font-bold whitespace-nowrap">任務完成</th>
                <th className="px-3 py-2 text-center font-bold rounded-tr-lg whitespace-nowrap">完成率</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={d.label} className={i % 2 === 0 ? 'bg-[#f4f1ea]' : 'bg-[#fffdf9]'}>
                  <td className="px-3 py-2 font-black text-[#5b755e] whitespace-nowrap">{d.label}</td>
                  <td className="px-3 py-2 text-[#3e362e] font-medium max-w-[160px] truncate">{d.fullName}</td>
                  <td className="px-3 py-2 text-center text-[#8a7f72] whitespace-nowrap">{d.startDate ? fmtDate(d.startDate) : '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      d.isCompleted
                        ? 'bg-[#dcedc1] text-[#4a7c59] border-[#8fb996]'
                        : d.taskCount > 0
                          ? 'bg-[#fff4c2] text-[#7a5c00] border-[#f0c060]'
                          : 'bg-[#f4f1ea] text-[#8a7f72] border-[#d3cbbd]'
                    }`}>
                      {d.isCompleted ? '已完成' : d.taskCount > 0 ? '進行中' : '待開始'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-[#5b755e] font-bold whitespace-nowrap">
                    {d.taskCount > 0 ? `${d.doneCount} / ${d.taskCount}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    {d.taskCount > 0 ? (
                      <div className="flex items-center gap-1.5 justify-center">
                        <div className="w-14 bg-[#e8d5b5] rounded-full h-1.5 overflow-hidden">
                          <div className="h-full rounded-full bg-[#5b755e]" style={{ width: `${d.completionRate}%` }} />
                        </div>
                        <span className="font-black text-[#5b755e] w-7 text-right">{d.completionRate}%</span>
                      </div>
                    ) : <span className="text-[#b5a695]">—</span>}
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
const PROGRESS_COLORS = ['#5b755e', '#e07a5f', '#76a5af', '#c8956c', '#9c7b9c', '#5a9c8e', '#9c5a7b', '#7b8b5a'];

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
  // 無明確設定時，以 completedDays 長度為準（已記錄的實際天數）
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

  // X 軸以實際天數為單位
  const xOf = (day: number) => PL + (day / maxTotalDays) * cW;
  const yOf = (pct: number) => PT + cH - (pct / 100) * cH;

  // X 軸刻度：依 maxTotalDays 選適合間隔
  const xInterval = maxTotalDays <= 14 ? 2 : maxTotalDays <= 30 ? 5 : 7;
  const xTicks: number[] = [];
  for (let d = 0; d <= maxTotalDays; d += xInterval) xTicks.push(d);
  if (xTicks[xTicks.length - 1] !== maxTotalDays) xTicks.push(maxTotalDays);

  const yGrids = [0, 25, 50, 75, 100];

  return (
    <section className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-lg overflow-hidden">
      <div className="bg-[#5b755e] px-6 py-4">
        <h2 className="text-lg font-black text-white">📊 Sprint 執行進度趨勢</h2>
        <p className="text-xs text-white/70 mt-0.5">每個 Sprint 的每日累積打卡率，虛線為各 Sprint 理想進度</p>
      </div>

      <div className="px-6 pt-5 pb-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 240 }}>
          {/* Y 軸水平格線 */}
          {yGrids.map(v => (
            <g key={v}>
              <line x1={PL} y1={yOf(v)} x2={W - PR} y2={yOf(v)}
                stroke={v === 0 ? '#c8b99a' : '#ede9e1'} strokeWidth={v === 0 ? 1.5 : 1} />
              <text x={PL - 5} y={yOf(v) + 4} textAnchor="end" fontSize="10" fill="#c8b99a">{v}%</text>
            </g>
          ))}

          {/* X 軸垂直格線 + 天數標籤 */}
          {xTicks.map(d => (
            <g key={`vg-${d}`}>
              <line x1={xOf(d)} y1={PT} x2={xOf(d)} y2={PT + cH}
                stroke={d === 0 || d === maxTotalDays ? '#c8b99a' : '#ede9e1'} strokeWidth="1" />
              <text x={xOf(d)} y={PT + cH + 14} textAnchor="middle" fontSize="10" fill="#b5a695">
                {d === 0 ? '0' : `第${d}天`}
              </text>
            </g>
          ))}

          {/* X 軸標題 */}
          <text x={PL + cW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#b5a695">執行天數</text>

          {/* 各 Sprint 理想進度線（依各自總天數，淡色虛線） */}
          {sprintsWithData.map((sprint, si) => {
            const totalDays = sprintTotals[si];
            const color = PROGRESS_COLORS[si % PROGRESS_COLORS.length];
            return (
              <line key={`ideal-${sprint.id}`}
                x1={xOf(0)} y1={yOf(0)} x2={xOf(totalDays)} y2={yOf(100)}
                stroke={color} strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.35" />
            );
          })}

          {/* Sprint 進度折線 */}
          {sprintsWithData.map((sprint, si) => {
            const completedDays = sprint.daily!.completedDays!;
            const totalDays = sprintTotals[si];
            const color = PROGRESS_COLORS[si % PROGRESS_COLORS.length];

            // 累積打卡點：X = 實際天數，Y = 累積打卡數 / 該 Sprint 總天數
            const points: { x: number; y: number }[] = [{ x: 0, y: 0 }];
            let cumul = 0;
            for (let i = 0; i < completedDays.length && i < totalDays; i++) {
              if (completedDays[i]) cumul++;
              points.push({
                x: i + 1,
                y: (cumul / totalDays) * 100,
              });
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
          <span className="flex items-center gap-1.5 text-xs text-[#b5a695] mr-1">
            <svg width="20" height="8" viewBox="0 0 20 8">
              <line x1="0" y1="4" x2="20" y2="4" stroke="#c8b99a" strokeWidth="1.5" strokeDasharray="5 3" />
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
              <span key={sprint.id} className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg bg-[#f4f1ea] border border-[#e8d5b5]" style={{ color }}>
                <svg width="16" height="8" viewBox="0 0 16 8">
                  <line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="2" />
                  <circle cx="8" cy="4" r="2.5" fill="white" stroke={color} strokeWidth="2" />
                </svg>
                <span>S{globalIdx + 1}</span>
                <span className="text-[#8a7f72] font-normal max-w-[100px] truncate">{name.length > 12 ? name.slice(0, 12) + '…' : name}</span>
                <span className="text-[#b5a695] font-normal">{checked}/{totalDays}天</span>
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
// ── Sprint 執行進度趨勢圖 end ─────────────────────────────

const STATUS_DOT: Record<string, string> = {
  'completed': 'bg-[#5b755e]',
  'in-progress': 'bg-[#e07a5f]',
  'pending': 'bg-[#b5a695]',
};
const STATUS_LABEL: Record<string, string> = {
  'completed': '已完成', 'in-progress': '進行中', 'pending': '待開始',
};
const STATUS_BADGE: Record<string, string> = {
  'completed': 'bg-[#dcedc1] text-[#4a7c59] border-[#8fb996]',
  'in-progress': 'bg-[#fff4c2] text-[#7a5c00] border-[#f0c060]',
  'pending': 'bg-[#f4f1ea] text-[#8a7f72] border-[#d3cbbd]',
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
      // 預設展開所有有資料的 sprint
      const ids = new Set(data.filter(s =>
        s.planning?.goal || (s.backlog?.tasks || []).length > 0 || s.review?.demo || s.retrospective?.actionItems
      ).map(s => s.id));
      setExpandedIds(ids);
      setLoading(false);
    };
    fetch().catch(() => setLoading(false));
  }, [user, authLoading]);

  // 依自訂日期區間篩選 sprint（以 planning.startDate 或 createdAt 為準）
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
      // 與主頁 dashboard 完全一致：只算有效 task
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
    // 時間期間：依篩選區間或自動取最早~最晚
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

  // 趨勢圖資料
  const chartData: ChartPoint[] = React.useMemo(() =>
    filteredSprints.map((s, i) => {
      const allItems = s.backlog?.tasks || [];
      const pbis = allItems.filter((t: Task) => t.status === 'pbi');
      const pbiIdSet = new Set(pbis.map((t: Task) => t.id));
      const tasks = allItems.filter((t: Task) => t.type === 'task' && t.pbiId && pbiIdSet.has(t.pbiId));
      const done = tasks.filter((t: Task) => t.status === 'done').length;
      const accepted = pbis.filter((t: Task) => !!t.acceptedBy).length;
      return {
        label: `S${i + 1}`,
        fullName: s.name || s.planning?.sprintName || `Sprint ${i + 1}`,
        completionRate: pct(done, tasks.length),
        acceptanceRate: pct(accepted, pbis.length),
        taskCount: tasks.length,
        doneCount: done,
        startDate: s.planning?.startDate || '',
        isCompleted: inferStatus(s) === 'completed',
      };
    })
  , [filteredSprints]);

  // 按年份分組
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
      <main className="min-h-screen bg-[#f4f1ea] flex items-center justify-center">
        <div className="text-[#5b755e] font-bold text-lg">載入成效資料中...</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f4f1ea] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-2xl font-bold text-[#3e362e]">請先登入</div>
          <Link href="/" className="text-[#5b755e] underline">返回首頁</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f1ea] font-serif text-[#3e362e] bg-[url('https://www.transparenttextures.com/patterns/rice-paper-2.png')] print:bg-white print:bg-none">
      <div className="max-w-[900px] mx-auto p-6 md:p-10 space-y-10">

        {/* 操作列 */}
        <div className="space-y-3 print:hidden">
          <div className="flex justify-between items-center">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#5b755e] bg-[#e8eedd] px-4 py-2 rounded-xl border-2 border-[#8fb996] hover:bg-[#dcedc1] transition-all">
              ← 返回專案大廳
            </Link>
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 text-sm font-bold text-white bg-[#5b755e] px-5 py-2 rounded-xl border-2 border-[#4a6350] hover:bg-[#4a6350] transition-all shadow">
              🖨 列印 / 匯出 PDF
            </button>
          </div>
          {/* 日期篩選列 */}
          <div className="bg-[#fffdf9] border-2 border-[#d3cbbd] rounded-2xl px-5 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-xs font-black text-[#5b755e] uppercase tracking-widest whitespace-nowrap">📅 日期篩選</span>
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <input
                type="date"
                value={filterFrom}
                onChange={e => setFilterFrom(e.target.value)}
                className="text-sm border-2 border-[#d3cbbd] rounded-xl px-3 py-1.5 bg-[#f4f1ea] text-[#3e362e] focus:outline-none focus:border-[#5b755e] transition-colors"
              />
              <span className="text-[#b5a695] font-bold">—</span>
              <input
                type="date"
                value={filterTo}
                onChange={e => setFilterTo(e.target.value)}
                className="text-sm border-2 border-[#d3cbbd] rounded-xl px-3 py-1.5 bg-[#f4f1ea] text-[#3e362e] focus:outline-none focus:border-[#5b755e] transition-colors"
              />
              {isFiltered && (
                <button
                  onClick={() => { setFilterFrom(''); setFilterTo(''); }}
                  className="text-xs font-bold text-[#e07a5f] bg-[#fff0ec] px-3 py-1.5 rounded-xl border-2 border-[#f0b4a4] hover:bg-[#fce4de] transition-all whitespace-nowrap"
                >
                  ✕ 清除篩選
                </button>
              )}
            </div>
            <div className="text-xs text-[#8a7f72] whitespace-nowrap">
              {isFiltered
                ? `顯示 ${filteredSprints.length} / ${sprints.length} 個 Sprint`
                : `共 ${sprints.length} 個 Sprint`}
            </div>
          </div>
        </div>

        {/* 封面標題 */}
        <section className="bg-[#5b755e] text-white rounded-3xl px-8 py-10 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-5 text-[18rem] leading-none font-black select-none pointer-events-none">S</div>
          <div className="relative z-10">
            <div className="text-xs font-bold opacity-60 mb-3 tracking-widest uppercase">Scrum Management Report · {today}</div>
            <h1 className="text-3xl md:text-5xl font-black leading-tight mb-2">
              敏捷開發<br/>成效歷程報告
            </h1>
            <div className="flex items-center gap-3 flex-wrap mb-8">
              <div className="text-sm opacity-70">{user.displayName || user.email} · 資訊部門</div>
              {metrics.periodFrom && (
                <div className="inline-flex items-center gap-1.5 bg-white/20 text-white text-sm font-bold px-3 py-1 rounded-full">
                  <span>📅</span>
                  <span>{metrics.periodFrom}</span>
                  <span className="opacity-60">–</span>
                  <span>{metrics.periodTo || today}</span>
                </div>
              )}
            </div>

            {/* 四格關鍵數字 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: '執行 Sprint', value: metrics.total, unit: '個' },
                { label: '已完成', value: metrics.completed, unit: '個' },
                { label: '任務完成率', value: metrics.completionRate, unit: '%' },
                { label: '參與成員', value: metrics.contributors, unit: '人', note: '跨 Sprint 不重複人名' },
              ].map(m => (
                <div key={m.label} className="bg-white/15 backdrop-blur rounded-2xl px-4 py-4 text-center" title={'note' in m ? '統計各 Sprint 開發名單、PO、SM 的不重複人名總數' : undefined}>
                  <div className="text-3xl font-black leading-none">{m.value}<span className="text-sm ml-0.5 font-bold opacity-70">{m.unit}</span></div>
                  <div className="text-xs opacity-60 mt-1">{m.label}</div>
                  {'note' in m && <div className="text-[10px] opacity-40 mt-0.5">{(m as {note:string}).note}</div>}
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
          <section className="bg-[#fffdf9] border-2 border-[#d3cbbd] rounded-2xl p-10 text-center text-[#8a7f72]">
            <div className="text-lg font-bold mb-2">尚無 Sprint 資料</div>
            <div className="text-sm mb-4">
              {isFiltered ? '目前篩選條件下沒有符合的 Sprint，請調整日期範圍。' : '請先建立並執行 Sprint，系統將自動彙整所有實際數據。'}
            </div>
            {!isFiltered && <Link href="/" className="text-sm font-bold text-[#5b755e] underline">前往建立 Sprint</Link>}
          </section>
        )}

        {/* ── 年度歷程表（主幹） ── */}
        {years.map(year => (
          <section key={year}>
            {/* 年份標題 */}
            <div className="flex items-center gap-4 mb-6">
              <div className="text-4xl font-black text-[#5b755e] leading-none">{year}</div>
              <div className="flex-1 h-0.5 bg-[#5b755e]/30 rounded" />
              <div className="text-sm text-[#8a7f72] font-bold">{sprintsByYear[year].length} 個 Sprint</div>
            </div>

            {/* 時間軸 */}
            <div className="relative">
              {/* 垂直主線 */}
              <div className="absolute left-[18px] top-4 bottom-4 w-0.5 bg-[#5b755e]/25 print:bg-[#5b755e]/40" />

              <div className="space-y-6">
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
                    <div key={sprint.id} className="flex gap-4">
                      {/* 時間軸節點 */}
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className={`w-9 h-9 rounded-full border-4 border-[#f4f1ea] flex items-center justify-center text-white text-xs font-black shadow-md z-10 ${STATUS_DOT[statusKey]}`}>
                          {statusKey === 'completed' ? '✓' : idx + 1}
                        </div>
                      </div>

                      {/* Sprint 卡片 */}
                      <div className="flex-1 min-w-0 bg-[#fffdf9] border-2 border-[#d3cbbd] rounded-2xl shadow-sm overflow-hidden mb-1">
                        {/* 卡片標題列 */}
                        <button
                          className="w-full px-5 py-4 flex items-start gap-3 text-left hover:bg-[#f4f1ea] transition-colors"
                          onClick={() => hasDetail && toggleExpand(sprint.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-[#3e362e] text-base">
                                {sprint.name || sprint.planning?.sprintName || '未命名 Sprint'}
                              </span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[statusKey]}`}>
                                {STATUS_LABEL[statusKey]}
                              </span>
                            </div>
                            {/* 摘要行 */}
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              {sprint.planning?.startDate && (
                                <span className="text-xs text-[#8a7f72]">📅 {getSprintDate(sprint)}{sprint.planning.duration ? ` · ${sprint.planning.duration}週` : ''}</span>
                              )}
                              {tasks.length > 0 && (
                                <span className="text-xs text-[#8a7f72]">📋 {tasks.length} 個任務 · 完成 {pct(done, tasks.length)}%</span>
                              )}
                              {(sprint.planning?.po || sprint.planning?.sm) && (
                                <span className="text-xs text-[#8a7f72]">
                                  👤 {[sprint.planning.po, sprint.planning.sm].filter(Boolean).join(' / ')}
                                </span>
                              )}
                            </div>
                          </div>
                          {hasDetail && (
                            <span className="text-[#b5a695] text-sm flex-shrink-0 mt-1">{isExpanded ? '▲' : '▼'}</span>
                          )}
                        </button>

                        {/* 展開內容 */}
                        {isExpanded && (
                          <div className="border-t-2 border-[#e8d5b5] bg-[#fdfaf6] px-5 py-5 space-y-5">

                            {/* Sprint Goal */}
                            {sprint.planning?.goal && (
                              <div>
                                <div className="text-xs font-black text-[#5b755e] uppercase tracking-widest mb-2">🎯 Sprint Goal</div>
                                <p className="text-sm font-medium text-[#3e362e] bg-[#e8eedd] px-4 py-3 rounded-xl border border-[#8fb996] leading-relaxed">
                                  {sprint.planning.goal}
                                </p>
                              </div>
                            )}

                            <div className="grid md:grid-cols-2 gap-5">
                              {/* 執行團隊 */}
                              {(sprint.planning?.po || sprint.planning?.sm || devNames.length > 0) && (
                                <div>
                                  <div className="text-xs font-black text-[#5b755e] uppercase tracking-widest mb-2">👥 執行團隊</div>
                                  <div className="space-y-1 text-sm">
                                    {sprint.planning?.po && (
                                      <div className="flex gap-2">
                                        <span className="text-[#8a7f72] w-24 flex-shrink-0">Product Owner</span>
                                        <span className="font-bold">{sprint.planning.po}</span>
                                      </div>
                                    )}
                                    {sprint.planning?.sm && (
                                      <div className="flex gap-2">
                                        <span className="text-[#8a7f72] w-24 flex-shrink-0">Scrum Master</span>
                                        <span className="font-bold">{sprint.planning.sm}</span>
                                      </div>
                                    )}
                                    {devNames.length > 0 && (
                                      <div className="flex gap-2">
                                        <span className="text-[#8a7f72] w-24 flex-shrink-0">開發團隊</span>
                                        <span className="font-bold">{devNames.join('、')}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* 任務數據 */}
                              {tasks.length > 0 && (
                                <div>
                                  <div className="text-xs font-black text-[#5b755e] uppercase tracking-widest mb-2">📊 執行數據</div>
                                  <div className="space-y-2">
                                    <div>
                                      <div className="flex justify-between text-xs mb-1">
                                        <span className="text-[#6b5e50]">任務完成率</span>
                                        <span className="text-[#8a7f72]">{done} / {tasks.length} 筆</span>
                                      </div>
                                      <MiniBar value={done} max={tasks.length} color="#5b755e" />
                                    </div>
                                    {accepted > 0 && (
                                      <div>
                                        <div className="flex justify-between text-xs mb-1">
                                          <span className="text-[#6b5e50]">PBI 驗收率</span>
                                          <span className="text-[#8a7f72]">{accepted} / {tasks.length} 筆</span>
                                        </div>
                                        <MiniBar value={accepted} max={tasks.length} color="#76a5af" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* PBI 清單 */}
                            {sprint.planning?.pbis && sprint.planning.pbis.length > 0 && (
                              <div>
                                <div className="text-xs font-black text-[#5b755e] uppercase tracking-widest mb-2">📋 PBI 清單（{sprint.planning.pbis.length} 項）</div>
                                <div className="flex flex-wrap gap-2">
                                  {sprint.planning.pbis.map((pbi, i) => (
                                    <span key={pbi.id || i} className="text-xs bg-[#f4f1ea] border border-[#d3cbbd] px-3 py-1 rounded-lg">
                                      {pbi.title}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Sprint Review */}
                            {(sprint.review?.opening || sprint.review?.demo || sprint.review?.future) && (
                              <div>
                                <div className="text-xs font-black text-[#e07a5f] uppercase tracking-widest mb-2">✨ Sprint Review 成果</div>
                                <div className="space-y-2">
                                  {sprint.review.opening && (
                                    <div>
                                      <div className="text-[10px] text-[#8a7f72] font-bold uppercase mb-1">開場總結</div>
                                      <p className="text-sm text-[#3e362e] bg-[#fdf6ee] px-4 py-3 rounded-xl border border-[#e8d5b5] whitespace-pre-wrap leading-relaxed">{sprint.review.opening}</p>
                                    </div>
                                  )}
                                  {sprint.review.demo && (
                                    <div>
                                      <div className="text-[10px] text-[#8a7f72] font-bold uppercase mb-1">成果演示</div>
                                      <p className="text-sm text-[#3e362e] bg-[#fdf6ee] px-4 py-3 rounded-xl border border-[#e8d5b5] whitespace-pre-wrap leading-relaxed">{sprint.review.demo}</p>
                                    </div>
                                  )}
                                  {sprint.review.future && (
                                    <div>
                                      <div className="text-[10px] text-[#8a7f72] font-bold uppercase mb-1">未來展望</div>
                                      <p className="text-sm text-[#3e362e] bg-[#fdf6ee] px-4 py-3 rounded-xl border border-[#e8d5b5] whitespace-pre-wrap leading-relaxed">{sprint.review.future}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Retrospective */}
                            {(sprint.retrospective?.keepStart || sprint.retrospective?.problemStop || sprint.retrospective?.actionItems) && (
                              <div>
                                <div className="text-xs font-black text-[#76a5af] uppercase tracking-widest mb-2">🔄 Retrospective 改善記錄</div>
                                <div className="grid md:grid-cols-3 gap-3">
                                  {sprint.retrospective.keepStart && (
                                    <div>
                                      <div className="text-[10px] font-black text-[#4a7c59] mb-1.5">✅ Keep / Start</div>
                                      <p className="text-xs text-[#3e362e] bg-[#e8eedd] px-3 py-2.5 rounded-xl border border-[#8fb996] whitespace-pre-wrap leading-relaxed">{sprint.retrospective.keepStart}</p>
                                    </div>
                                  )}
                                  {sprint.retrospective.problemStop && (
                                    <div>
                                      <div className="text-[10px] font-black text-[#c96262] mb-1.5">⚠️ Problem / Stop</div>
                                      <p className="text-xs text-[#3e362e] bg-[#fceded] px-3 py-2.5 rounded-xl border border-[#e8b4b4] whitespace-pre-wrap leading-relaxed">{sprint.retrospective.problemStop}</p>
                                    </div>
                                  )}
                                  {sprint.retrospective.actionItems && (
                                    <div>
                                      <div className="text-[10px] font-black text-[#467386] mb-1.5">🚀 Action Items</div>
                                      <p className="text-xs text-[#3e362e] bg-[#c2dce3]/40 px-3 py-2.5 rounded-xl border border-[#76a5af] whitespace-pre-wrap leading-relaxed">{sprint.retrospective.actionItems}</p>
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
          <section className="bg-[#3e362e] text-white rounded-3xl px-8 py-8 shadow-xl">
            <h2 className="text-lg font-black mb-3 opacity-90">📣 數據說明</h2>
            <p className="text-sm leading-relaxed opacity-80">
              以上所有內容均直接擷取自資訊部門的 Scrum 執行系統，未經任何人工修改。
              {metrics.total} 個 Sprint、{metrics.totalTasks} 筆工作項目、{metrics.contributors} 位成員參與、{metrics.totalEdits} 筆操作記錄。
              {metrics.completionRate > 0 && ` 整體任務完成率 ${metrics.completionRate}%`}{metrics.acceptanceRate > 0 && `、PBI 驗收率 ${metrics.acceptanceRate}%`}。
            </p>
            <div className="mt-4 text-xs opacity-40">報告產生時間：{today} · 資訊部門 Scrum 管理系統</div>
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
