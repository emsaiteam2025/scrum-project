"use client";
import React, { useState, useEffect } from 'react';
import { useAutoSave } from '@/hooks/useAutoSave';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import ScrumTooltip from '@/components/ScrumTooltip';

export default function DailyScrum() {
  const [sprintDays, setSprintDays] = useState<number>(30);

  const { data, updateData, loading } = useAutoSave('daily', {
    completedDays: [] as boolean[],
    dailyNotes: {} as Record<number, string>
  });

  const completedDays = data.completedDays;
  const dailyNotes = data.dailyNotes || {};
  const [activeDay, setActiveDay] = useState<number | null>(null);

  useEffect(() => {
    // 取得使用者設定的天數，預設 30
    const savedDays = localStorage.getItem('sprintDays');
    const daysCount = savedDays ? Number(savedDays) : 30;
    setSprintDays(daysCount);
    
    // 若初始化狀態為空或長度不對，則初始化
    if (completedDays.length !== daysCount && !loading) {
      updateData({ completedDays: Array(daysCount).fill(false) });
    }
  }, [loading]);

  const updateNote = (index: number, text: string) => {
    updateData({ dailyNotes: { ...dailyNotes, [index]: text } });
  };

  const toggleDay = (index: number) => {
    setActiveDay(index === activeDay ? null : index);
  };
  
  const toggleCheck = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const newDays = [...completedDays];
    newDays[index] = !newDays[index];
    updateData({ completedDays: newDays });
  };
  return (
    <main className="min-h-screen bg-[#f4f1ea] p-8 font-serif text-[#3e362e] bg-[url('https://www.transparenttextures.com/patterns/rice-paper-2.png')]">
      <div className="max-w-[1200px] mx-auto space-y-8">
        
        <Navigation />

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

        {/* 動態天數打卡追蹤 */}
        <section className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-[#8fb996] border-b-4 border-[#5b755e] p-4 text-xl font-bold text-white tracking-wider flex items-center gap-2 drop-shadow-sm">
            <span>📅</span> {sprintDays} 天進度追蹤 (D1 - D{sprintDays})
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {Array.from({ length: sprintDays }).map((_, i) => {
                const isChecked = completedDays[i];
                return (
                  
                  <div key={i} className={`transition-all duration-300 ${activeDay === i ? 'col-span-full' : ''}`}>
                  <div 
                    onClick={() => toggleDay(i)}
                    className={`border-4 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group relative overflow-hidden min-h-[120px]
                      ${isChecked 
                        ? 'bg-[#8fb996] border-[#5b755e] shadow-md' 
                        : 'bg-[#e8eedd] border-[#a5c2a8] hover:bg-[#dcedc1] hover:-translate-y-1 hover:shadow-md'
                      }
                      ${activeDay === i ? 'ring-4 ring-[#e07a5f] scale-[1.02]' : ''}
                      `}
                  >
                    <div className={`absolute top-3 right-3 flex items-center justify-center w-6 h-6 rounded border-2 ${isChecked ? 'bg-white border-white text-[#5b755e]' : 'border-[#8a7f72] bg-white'}`} onClick={(e) => toggleCheck(e, i)}>
                      {isChecked && '✓'}
                    </div>
                    <div className={`font-bold text-lg z-10 transition-transform ${isChecked ? 'text-white' : 'text-[#4a7c59] group-hover:scale-110'}`}>
                      Day {i + 1}
                    </div>
                    <div className={`text-3xl mt-2 z-10 transition-all ${isChecked ? 'opacity-100 scale-125' : 'opacity-50 group-hover:opacity-100'}`}>
                      {isChecked ? '✅' : '🌱'}
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
                      <h3 className="text-[#5b755e] font-bold text-xl mb-4 flex items-center gap-2">
                        <span>📝</span> Day {i + 1} 執行事項與阻礙紀錄
                      </h3>
                      <textarea
                        value={dailyNotes[i] || ''}
                        onChange={(e) => updateNote(i, e.target.value)}
                        placeholder="請記錄：&#10;1. 昨天完成了什麼？&#10;2. 今天預計要做什麼？&#10;3. 目前有沒有遇到任何阻礙？"
                        className="w-full h-40 p-4 border-2 border-[#a5c2a8] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 bg-white text-[#3e362e] resize-none shadow-inner"
                      />
                      <div className="flex justify-end mt-4">
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
