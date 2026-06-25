"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const pageNameMap: Record<string, string> = {
  planning: 'Sprint Planning',
  backlog: 'Sprint Backlog',
  'daily-scrum': 'Daily Scrum',
  review: 'Sprint Review',
  retrospective: 'Sprint Retrospective',
};

interface HistoryEntry {
  email: string;
  name: string;
  ts: number;
  page: string;
  changes?: string;
}

function formatTs(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }) + ' ' +
    d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
}

export default function Navigation() {
  const pathname = usePathname();
  const { user, loading, signInWithGoogle, logout } = useAuth();
  const [currentSprintName, setCurrentSprintName] = useState<string>('');
  const [currentSprintId, setCurrentSprintId] = useState<string>('');
  const [isViewMode, setIsViewMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    // URL 參數優先（當直接開啟帶 sprint 參數的網址時同步到 localStorage）
    const params = new URLSearchParams(window.location.search);
    const urlSprintId = params.get('sprint');
    if (urlSprintId) {
      localStorage.setItem('currentSprintId', urlSprintId);
    }
    const sprintId = urlSprintId || localStorage.getItem('currentSprintId') || '';
    if (sprintId) {
      setCurrentSprintId(sprintId);
      setIsViewMode(localStorage.getItem('sprintRole_' + sprintId) === 'viewer_via_link');
    }
    const sprintName = localStorage.getItem('currentSprintName');
    if (sprintName) setCurrentSprintName(sprintName);
  }, []);

  // 登入後重新驗證角色：若 localStorage 有 viewer_via_link 但實際有編輯權，清除舊旗標
  useEffect(() => {
    if (!user || !currentSprintId) return;
    const storedRole = localStorage.getItem('sprintRole_' + currentSprintId);
    if (storedRole !== 'viewer_via_link') return; // 沒有衝突，不處理

    (async () => {
      try {
        const snap = await getDoc(doc(db, 'sprints', currentSprintId));
        if (!snap.exists()) return;
        const data = snap.data();
        const isOwner = !data.ownerId || data.ownerId === user.uid;
        const collaboratorRole = (data.collaborators || []).find(
          (c: { email: string; role: string }) => c.email.toLowerCase() === (user.email || '').toLowerCase()
        )?.role;
        const hasEditAccess = isOwner || collaboratorRole === 'editor';
        if (hasEditAccess) {
          localStorage.removeItem('sprintRole_' + currentSprintId);
          setIsViewMode(false);
        }
      } catch {}
    })();
  }, [user, currentSprintId]);

  const openHistory = async () => {
    const sprintId = localStorage.getItem('currentSprintId');
    if (!sprintId) return;
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const snap = await getDoc(doc(db, 'sprints', sprintId));
      if (snap.exists()) {
        const history: HistoryEntry[] = snap.data().editHistory || [];
        setHistoryEntries([...history].sort((a, b) => b.ts - a.ts));
      } else {
        setHistoryEntries([]);
      }
    } catch {
      setHistoryEntries([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const navItems = [
    { path: '/planning', label: 'Sprint Planning', num: '1' },
    { path: '/backlog', label: 'Sprint Backlog', num: '2' },
    { path: '/daily-scrum', label: 'Daily Scrum', num: '3' },
    { path: '/review', label: 'Sprint Review', num: '4' },
    { path: '/retrospective', label: 'Sprint Retrospective', num: '5' },
  ];

  // 產生帶 sprint 參數的路徑
  const sprintHref = (path: string) =>
    currentSprintId ? `${path}?sprint=${currentSprintId}` : path;

  return (
    <div className="mb-8 w-full">
      {/* 頂部快捷列 */}
      <div className="flex justify-between items-center mb-4 px-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="bg-[#e8eedd] text-[#5b755e] border-2 border-[#8fb996] px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-[#dcedc1] transition-all flex items-center gap-2"
          >
            <span>📚</span> 回到專案大廳 (Sprint 清單)
          </Link>
          <Link
            href="/knowledge"
            className="bg-[#c2dce3] text-[#467386] border-2 border-[#76a5af] px-3 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-[#aecfd8] transition-all flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>🧠</span> 知識學習
          </Link>
        </div>
        <div className="text-[10px] font-bold text-[#b5a695] ml-2 px-2 py-1 bg-[#fffdf9] rounded border border-[#e8d5b5]">v1.0.209</div>
        {currentSprintName && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-bold text-[#6b5e50] bg-[#fffdf9] px-4 py-2 rounded-xl border-2 border-[#b5a695] shadow-sm">
              當前專案：{currentSprintName}
            </div>
            {isViewMode && (
              <div className="text-xs font-bold text-[#7a5c00] bg-[#fff4c2] px-3 py-1.5 rounded-xl border-2 border-[#f0c060] shadow-sm whitespace-nowrap">
                👁 檢視模式
              </div>
            )}
            {!isViewMode && (
              <button
                onClick={openHistory}
                className="text-xs font-bold text-[#5b755e] bg-[#e8eedd] px-3 py-1.5 rounded-xl border-2 border-[#8fb996] shadow-sm hover:bg-[#dcedc1] transition-all whitespace-nowrap"
              >
                📋 編輯記錄
              </button>
            )}
          </div>
        )}
      </div>

      {/* 導覽列 */}
      <nav className="w-full bg-[#fffdf9] border-4 border-[#5b755e] rounded-2xl shadow-md overflow-hidden flex flex-col md:flex-row">
      {navItems.map((item, index) => {
        const isActive = pathname === item.path;
        const currentIndex = navItems.findIndex(n => n.path === pathname);
        const isCompleted = index < currentIndex;

        return (
          <Link
            key={item.path}
            href={sprintHref(item.path)}
            className={`flex-1 flex items-center justify-center p-4 relative font-bold text-sm lg:text-base transition-all
              ${isActive
                ? 'bg-[#e07a5f] text-white'
                : isCompleted
                  ? 'bg-[#e8eedd] text-[#5b755e] hover:bg-[#dcedc1]'
                  : 'bg-[#fffdf9] text-[#b5a695] hover:bg-[#f4f1ea]'
              }
              ${index !== 0 ? 'border-t-4 md:border-t-0 md:border-l-4 border-[#5b755e]' : ''}
            `}
          >
            <div className="flex items-center gap-2">
              <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs border-2
                ${isActive ? 'border-white text-[#e07a5f] bg-white' : isCompleted ? 'border-[#5b755e] text-white bg-[#5b755e]' : 'border-[#b5a695] text-[#b5a695]'}`}
              >
                {isCompleted ? '✓' : item.num}
              </span>
              <span>{item.label}</span>
            </div>
          </Link>
        );
      })}

      {/* 帳號登入區塊 */}
      <div className="flex-1 max-w-[200px] bg-[#d3cbbd] border-t-4 md:border-t-0 md:border-l-4 border-[#5b755e] flex items-center justify-center p-2">
        {loading ? (
          <div className="text-[#6b5e50] text-sm font-bold">讀取中...</div>
        ) : user ? (
          <div className="flex flex-col items-center">
            <div className="text-xs font-bold text-[#5b755e] truncate max-w-[150px]">{user.displayName || user.email}</div>
            <button onClick={logout} className="text-xs text-white bg-[#e07a5f] px-3 py-1 rounded mt-1 hover:bg-[#c66147] transition-colors">
              登出
            </button>
          </div>
        ) : (
          <button onClick={signInWithGoogle} className="flex items-center gap-2 bg-white text-[#3e362e] border-2 border-[#b5a695] px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-[#f4f1ea] transition-all shadow-sm">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
            Google 登入
          </button>
        )}
      </div>
      </nav>

      {/* 編輯記錄 Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowHistory(false)}>
          <div className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-[#5b755e] text-white px-6 py-4 rounded-t-2xl flex items-center justify-between flex-shrink-0">
              <h2 className="font-bold text-lg">📋 編輯記錄</h2>
              <button onClick={() => setShowHistory(false)} className="text-white/70 hover:text-white text-xl font-bold leading-none">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {historyLoading ? (
                <div className="text-center py-8 text-[#8a7f72] font-bold">載入中...</div>
              ) : historyEntries.length === 0 ? (
                <div className="text-center py-8 text-[#8a7f72]">尚無編輯記錄<br/><span className="text-xs">儲存後即開始記錄</span></div>
              ) : (
                <div className="space-y-2">
                  {historyEntries.map((entry, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3 bg-[#f4f1ea] rounded-xl border border-[#e8d5b5]">
                      <div className="w-9 h-9 rounded-full bg-[#5b755e] text-white flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                        {(entry.name || entry.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-bold text-sm text-[#3e362e] truncate">{entry.name || entry.email}</div>
                          <div className="text-xs text-[#b5a695] whitespace-nowrap flex-shrink-0">{formatTs(entry.ts)}</div>
                        </div>
                        <div className="text-xs text-[#8a7f72] mt-0.5">{pageNameMap[entry.page] || entry.page}</div>
                        {entry.changes && (
                          <div className="mt-1.5 bg-[#e8eedd] px-2 py-1.5 rounded-lg border border-[#8fb996] space-y-0.5">
                            {entry.changes.split('\n').map((line, j) => (
                              <div key={j} className="text-xs text-[#3e6b47] font-medium flex gap-1">
                                <span className="flex-shrink-0">✏</span>
                                <span>{line}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-4 pb-4 flex-shrink-0">
              <div className="text-xs text-center text-[#b5a695]">顯示最近 {historyEntries.length} 筆記錄（每次開啟頁面記錄一次）</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
