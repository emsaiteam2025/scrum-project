"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useEffect, useState } from 'react';

export default function Navigation() {
  const pathname = usePathname();
  const { user, loading, signInWithGoogle, logout } = useAuth();
  const [currentSprintName, setCurrentSprintName] = useState<string>('');

  useEffect(() => {
    const sprintName = localStorage.getItem('currentSprintName');
    if (sprintName) setCurrentSprintName(sprintName);
  }, []);

  const navItems = [
    { path: '/planning', label: 'Sprint Planning', num: '1' },
    { path: '/backlog', label: 'Sprint Backlog', num: '2' },
    { path: '/daily-scrum', label: 'Daily Scrum', num: '3' },
    { path: '/review', label: 'Sprint Review', num: '4' },
    { path: '/retrospective', label: 'Sprint Retrospective', num: '5' },
  ];

  return (
    <div className="mb-8 w-full">
      {/* 頂部快捷列：回到大廳 & 顯示當前專案 */}
      <div className="flex justify-between items-center mb-4 px-2">
        <Link 
          href="/" 
          className="bg-[#e8eedd] text-[#5b755e] border-2 border-[#8fb996] px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-[#dcedc1] transition-all flex items-center gap-2"
        >
          <span>📚</span> 回到專案大廳 (Sprint 清單)
        </Link>
        <div className="text-[10px] font-bold text-[#b5a695] ml-2 px-2 py-1 bg-[#fffdf9] rounded border border-[#e8d5b5]">v1.0.38</div>
        {currentSprintName && (
          <div className="text-sm font-bold text-[#6b5e50] bg-[#fffdf9] px-4 py-2 rounded-xl border-2 border-[#b5a695] shadow-sm truncate max-w-[300px]">
            當前專案：{currentSprintName}
          </div>
        )}
      </div>

      {/* 原本的導覽列 */}
      <nav className="w-full bg-[#fffdf9] border-4 border-[#5b755e] rounded-2xl shadow-md overflow-hidden flex flex-col md:flex-row">
      {navItems.map((item, index) => {
        const isActive = pathname === item.path;
        // Determine if this item is before the active item to give it a "completed" look
        const currentIndex = navItems.findIndex(n => n.path === pathname);
        const isCompleted = index < currentIndex;

        return (
          <Link 
            key={item.path}
            href={item.path}
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
    </div>
  );
}
