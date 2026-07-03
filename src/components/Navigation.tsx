"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { BookOpen, Brain, ClipboardList, Check, Eye, Pencil, X } from 'lucide-react';

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
    if (storedRole !== 'viewer_via_link') return;

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
      <div className="flex justify-between items-center mb-3 px-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E9E5DA] text-[#5A574E] rounded-lg text-sm hover:shadow-sm hover:-translate-y-[1px] transition-all duration-150"
          >
            <BookOpen size={15} strokeWidth={1.75} />
            回到專案大廳
          </Link>
          <Link
            href="/knowledge"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E9E5DA] text-[#5A574E] rounded-lg text-sm hover:shadow-sm hover:-translate-y-[1px] transition-all duration-150 whitespace-nowrap"
          >
            <Brain size={15} strokeWidth={1.75} />
            知識學習
          </Link>
          <span className="text-[10px] font-mono text-[#B5B2A6] ml-1">v1.0.231</span>
        </div>

        {currentSprintName && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 pl-3 border-l border-[#E9E5DA]">
              <span className="text-sm text-[#8B887E]">當前專案：</span>
              <span className="text-sm font-semibold text-[#1F1D17]">{currentSprintName}</span>
            </div>
            {isViewMode && (
              <div className="flex items-center gap-1 text-xs text-[#B8893A] bg-[#F0E4C9] px-2.5 py-1 rounded-lg border border-[#E9E5DA]">
                <Eye size={12} strokeWidth={1.75} />
                檢視模式
              </div>
            )}
            {!isViewMode && (
              <button
                onClick={openHistory}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-[#E9E5DA] text-[#5A574E] rounded-lg hover:shadow-sm hover:-translate-y-[1px] transition-all duration-150 whitespace-nowrap"
              >
                <ClipboardList size={13} strokeWidth={1.75} />
                編輯記錄
              </button>
            )}
          </div>
        )}
      </div>

      {/* 導覽列 */}
      <nav className="w-full bg-white border border-[#E9E5DA] rounded-[10px] overflow-hidden flex flex-col md:flex-row">
        {navItems.map((item, index) => {
          const isActive = pathname === item.path;
          const currentIndex = navItems.findIndex(n => n.path === pathname);
          const isCompleted = index < currentIndex;

          return (
            <Link
              key={item.path}
              href={sprintHref(item.path)}
              className={`flex-1 flex items-center justify-center px-4 py-3 relative text-sm transition-all duration-150
                ${isActive
                  ? 'bg-[#F1EEE6] text-[#1F1D17] font-semibold'
                  : isCompleted
                    ? 'text-[#5A574E] hover:bg-[#F6F3EB]'
                    : 'text-[#8B887E] hover:bg-[#F6F3EB]'
                }
                ${index !== 0 ? 'border-t md:border-t-0 md:border-l border-[#E9E5DA]' : ''}
              `}
            >
              <div className="flex items-center gap-2">
                <span className={`flex items-center justify-center w-5 h-5 rounded-full font-mono text-[11px] flex-shrink-0
                  ${isActive
                    ? 'border-[1.5px] border-[#1F1D17] text-[#1F1D17]'
                    : isCompleted
                      ? 'border-[1.5px] border-[#5A574E] text-[#5A574E]'
                      : 'border-[1.5px] border-[#B5B2A6] text-[#B5B2A6]'
                  }`}
                >
                  {isCompleted ? <Check size={11} strokeWidth={2} /> : item.num}
                </span>
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}

        {/* 帳號登入區塊 */}
        <div className="flex-1 max-w-[200px] bg-[#F6F3EB] border-t md:border-t-0 md:border-l border-[#E9E5DA] flex items-center justify-center p-2">
          {loading ? (
            <div className="text-[#8B887E] text-xs">讀取中...</div>
          ) : user ? (
            <div className="flex flex-col items-center gap-1">
              <div className="text-xs text-[#5A574E] truncate max-w-[150px]">{user.displayName || user.email}</div>
              <button onClick={logout} className="text-xs text-white bg-[#C96442] px-3 py-0.5 rounded-md hover:bg-[#7A3520] transition-colors">
                登出
              </button>
            </div>
          ) : (
            <button onClick={signInWithGoogle} className="flex items-center gap-1.5 bg-white text-[#1F1D17] border border-[#E9E5DA] px-3 py-1.5 rounded-lg text-xs hover:shadow-sm hover:-translate-y-[1px] transition-all duration-150">
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
              Google 登入
            </button>
          )}
        </div>
      </nav>

      {/* 編輯記錄 Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowHistory(false)}>
          <div className="bg-white border border-[#E9E5DA] rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-white border-b border-[#E9E5DA] px-6 py-4 rounded-t-xl flex items-center justify-between flex-shrink-0">
              <h2 className="font-semibold text-[#1F1D17] flex items-center gap-2">
                <ClipboardList size={16} strokeWidth={1.75} className="text-[#8B887E]" />
                編輯記錄
              </h2>
              <button onClick={() => setShowHistory(false)} className="text-[#8B887E] hover:text-[#1F1D17] transition-colors">
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {historyLoading ? (
                <div className="text-center py-8 text-[#8B887E] text-sm">載入中...</div>
              ) : historyEntries.length === 0 ? (
                <div className="text-center py-8 text-[#8B887E] text-sm">
                  尚無編輯記錄<br/>
                  <span className="text-xs text-[#B5B2A6]">儲存後即開始記錄</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {historyEntries.map((entry, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3 border border-[#E9E5DA] rounded-[10px]">
                      <div className="w-8 h-8 rounded-full bg-[#F1EEE6] text-[#5A574E] flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                        {(entry.name || entry.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-sm text-[#1F1D17] truncate">{entry.name || entry.email}</div>
                          <div className="text-xs text-[#B5B2A6] whitespace-nowrap flex-shrink-0">{formatTs(entry.ts)}</div>
                        </div>
                        <div className="text-xs text-[#8B887E] mt-0.5">{pageNameMap[entry.page] || entry.page}</div>
                        {entry.changes && (
                          <div className="mt-1.5 bg-[#F6F3EB] px-2 py-1.5 rounded-lg space-y-0.5">
                            {entry.changes.split('\n').map((line, j) => (
                              <div key={j} className="text-xs text-[#5A574E] flex gap-1.5 items-start">
                                <Pencil size={11} strokeWidth={1.75} className="flex-shrink-0 mt-0.5 text-[#8B887E]" />
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
              <div className="text-xs text-center text-[#B5B2A6]">顯示最近 {historyEntries.length} 筆記錄（每次開啟頁面記錄一次）</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
