"use client";

import React from 'react';
import { useAutoSave } from '@/hooks/useAutoSave';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import ScrumTooltip from '@/components/ScrumTooltip';

export default function SprintReview() {
  const { data, updateData, loading } = useAutoSave('review', {
    opening: '',
    demo: '',
    market: '',
    future: ''
  });

  return (
    <main className="min-h-screen bg-[#f4f1ea] p-8 font-serif text-[#3e362e] bg-[url('https://www.transparenttextures.com/patterns/rice-paper-2.png')]">
      <div className="max-w-[1000px] mx-auto space-y-8">
        
        <Navigation />

        {/* Loading Overlay */}
        {loading && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"><div className="bg-white px-6 py-4 rounded-xl font-bold text-[#5b755e] shadow-xl text-lg flex items-center gap-3"><span>💾</span> <span>載入資料中...</span></div></div>}

        {/* 內容區塊 */}
        <section className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-xl overflow-hidden relative">
          <div className="bg-[#d4a373] border-b-4 border-[#5b755e] p-4 text-xl font-bold text-white tracking-wider flex justify-between items-center drop-shadow-sm">
            <div className="flex items-center gap-2">
              <span>🌻</span> <ScrumTooltip keyword="Sprint Review" text="向利益關係人展示成果 (Sprint Review)" />
            </div>
            <div className="bg-[#8b5a2b] px-3 py-1 rounded-lg text-sm">
              依 Sprint 週期限時
            </div>
          </div>
          
          <div className="p-8 space-y-8">
            
            {/* 開場 (10%) */}
            <div className="flex flex-col gap-2 relative">
              <div className="absolute -left-4 top-2 w-2 h-full bg-[#e07a5f] rounded-full"></div>
              <label className="font-bold text-xl text-[#8a4231] flex items-center gap-2">
                <span>🎤</span> 開場與進度總結 (10%) 
                <span className="text-sm font-bold bg-[#fceded] text-[#c96262] px-2 py-0.5 rounded border border-[#e6b1b1]">PO 負責</span>
              </label>
              <textarea 
                className="w-full mt-2 px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#d4a373]/50 shadow-inner font-medium text-[#3e362e] transition-all" 
                rows={3}
                placeholder="總結本次 Sprint 的目標達成狀況..."
                value={data.opening}
                onChange={e => updateData({ opening: e.target.value })}
              />
            </div>

            {/* 展示 (50%) */}
            <div className="flex flex-col gap-2 relative">
              <div className="absolute -left-4 top-2 w-2 h-full bg-[#8fb996] rounded-full"></div>
              <label className="font-bold text-xl text-[#4a7c59] flex items-center gap-2">
                <span>✨</span> 成果演示與體驗 (50%)
              </label>
              <textarea 
                className="w-full mt-2 px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner font-medium text-[#3e362e] transition-all min-h-[150px]" 
                placeholder="記錄展示的具體功能與現場反饋..."
                value={data.demo}
                onChange={e => updateData({ demo: e.target.value })}
              />
            </div>

            {/* 市場與現況 (20%) */}
            <div className="flex flex-col gap-2 relative">
              <div className="absolute -left-4 top-2 w-2 h-full bg-[#76a5af] rounded-full"></div>
              <label className="font-bold text-xl text-[#467386] flex items-center gap-2">
                <span>🌍</span> 市場與現況討論 (20%)
                <span className="text-sm font-bold bg-[#fceded] text-[#c96262] px-2 py-0.5 rounded border border-[#e6b1b1]">PO 負責</span>
              </label>
              <textarea 
                className="w-full mt-2 px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#76a5af]/50 shadow-inner font-medium text-[#3e362e] transition-all" 
                rows={3}
                placeholder="討論市場變化、業務需求調整..."
                value={data.market}
                onChange={e => updateData({ market: e.target.value })}
              />
            </div>

            {/* 展望未來 (20%) */}
            <div className="flex flex-col gap-2 relative">
              <div className="absolute -left-4 top-2 w-2 h-full bg-[#d3cbbd] rounded-full"></div>
              <label className="font-bold text-xl text-[#6b5e50] flex items-center gap-2">
                <span>🔭</span> 展望未來 (20%)
                <span className="text-sm font-bold bg-[#e8e4d9] text-[#6b5e50] px-2 py-0.5 rounded border border-[#b5a695]">調查品清單</span>
              </label>
              <textarea 
                className="w-full mt-2 px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#b5a695]/50 shadow-inner font-medium text-[#3e362e] transition-all" 
                rows={3}
                placeholder="為下個 Sprint 或長期目標的建議..."
                value={data.future}
                onChange={e => updateData({ future: e.target.value })}
              />
            </div>

          </div>
        </section>

        <div className="flex justify-end pt-4">
          <Link href="/retrospective" className="bg-[#e07a5f] text-white px-8 py-3 rounded-full font-bold text-lg hover:bg-[#c66147] hover:-translate-y-1 transition-all duration-200 shadow-lg border-2 border-[#8a4231] inline-flex items-center gap-2">
            <span>🚂</span> 前往 Sprint Retrospective (回顧會議)
          </Link>
        </div>
        
      </div>
    </main>
  );
}
