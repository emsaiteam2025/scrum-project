import React from 'react';
import Navigation from '@/components/Navigation';
import ScrumTooltip from '@/components/ScrumTooltip';

export default function SprintRetrospective() {
  return (
    <main className="min-h-screen bg-[#f4f1ea] p-8 font-serif text-[#3e362e] bg-[url('https://www.transparenttextures.com/patterns/rice-paper-2.png')]">
      <div className="max-w-[1200px] mx-auto space-y-8">
        
        <Navigation />

        {/* 頂部：會議目標 */}
        <section className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-xl overflow-hidden relative">
          <div className="bg-[#76a5af] border-b-4 border-[#5b755e] p-4 text-xl font-bold text-white tracking-wider flex items-center gap-2 drop-shadow-sm">
            <span>🦉</span> <ScrumTooltip keyword="Sprint Retrospective" text="會議宗旨 (Sprint Retrospective)" />
          </div>
          <div className="p-6 bg-[#c2dce3]/30">
            <div className="text-center font-bold text-[#467386] text-xl flex items-center justify-center gap-4">
              <span>✨ 檢視 DoD + AC</span>
              <span>•</span>
              <span>✨ 增加產出品質</span>
              <span>•</span>
              <span>✨ 提升團隊效能</span>
            </div>
          </div>
        </section>

        {/* 三大回顧區塊 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Keep / Start */}
          <section className="bg-[#fffdf9] border-4 border-[#8fb996] rounded-3xl shadow-lg overflow-hidden flex flex-col h-full hover:-translate-y-1 transition-transform">
            <div className="bg-[#dcedc1] border-b-4 border-[#8fb996] p-4 text-center">
              <div className="text-3xl mb-2">🌱</div>
              <h2 className="text-xl font-bold text-[#4a7c59]">什麼做得好？</h2>
              <div className="text-sm font-bold text-[#6b5e50] mt-1">(Keep / Start)</div>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <textarea 
                className="flex-1 w-full p-4 bg-[#f9fcf8] border-2 border-[#8fb996] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner font-medium text-[#3e362e] resize-none min-h-[250px]" 
                placeholder="記錄團隊本次表現優異、值得保留或開始嘗試的作法..."
              />
            </div>
          </section>

          {/* Problem / Stop */}
          <section className="bg-[#fffdf9] border-4 border-[#c96262] rounded-3xl shadow-lg overflow-hidden flex flex-col h-full hover:-translate-y-1 transition-transform">
            <div className="bg-[#fceded] border-b-4 border-[#c96262] p-4 text-center">
              <div className="text-3xl mb-2">🍂</div>
              <h2 className="text-xl font-bold text-[#c96262]">什麼需要改善？</h2>
              <div className="text-sm font-bold text-[#8a4231] mt-1">(Problem / Stop)</div>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <textarea 
                className="flex-1 w-full p-4 bg-[#fdf8f8] border-2 border-[#e6b1b1] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#e6b1b1]/50 shadow-inner font-medium text-[#3e362e] resize-none min-h-[250px]" 
                placeholder="記錄遇到的阻礙、問題或需要停止的不良習慣..."
              />
            </div>
          </section>

          {/* Action Items */}
          <section className="bg-[#fffdf9] border-4 border-[#d4a373] rounded-3xl shadow-lg overflow-hidden flex flex-col h-full hover:-translate-y-1 transition-transform">
            <div className="bg-[#f2e3c6] border-b-4 border-[#d4a373] p-4 text-center relative overflow-hidden">
              <div className="absolute -top-2 -right-2 text-6xl opacity-20">⭐</div>
              <div className="text-3xl mb-2 relative z-10">🚂</div>
              <h2 className="text-xl font-bold text-[#8b5a2b] relative z-10">挑戰最大效益來改</h2>
              <div className="text-sm font-bold text-[#6b5e50] mt-1 relative z-10">(Action Items)</div>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <textarea 
                className="flex-1 w-full p-4 bg-[#fcfbf9] border-2 border-[#e8d5b5] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#d4a373]/50 shadow-inner font-medium text-[#3e362e] resize-none min-h-[250px]" 
                placeholder="列出下個 Sprint 的具體改進行動項目..."
              />
            </div>
          </section>

        </div>

        <div className="flex justify-end pt-4">
          <button className="bg-[#8fb996] text-white px-8 py-3 rounded-full font-bold text-lg hover:bg-[#78a07e] hover:-translate-y-1 transition-all duration-200 shadow-lg border-2 border-[#5b755e] inline-flex items-center gap-2">
            <span>🎉</span> 結束本次 Sprint 並存檔
          </button>
        </div>
        
      </div>
    </main>
  );
}
