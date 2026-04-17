"use client";
import React, { useState } from 'react';
import { useAutoSave } from '@/hooks/useAutoSave';
import Link from 'next/link';

import Navigation from '@/components/Navigation';
import ScrumTooltip from '@/components/ScrumTooltip';

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [projectName, setProjectName] = useState('');

  const { data, updateData, loading } = useAutoSave('planning', {
    poIdea: '',
    timeLimit: '2',
    startDate: '',
    stakeholders: '利益關係人、專家',
    po: '',
    sm: '',
    devs: '',
    whys: [{ id: '1', text: '' }],
    whats: [{ id: '1', text: '' }],
    hows: [{ id: '1', text: '' }]
  });

  // 元件載入時讀取 API Key 與 專案名稱
  React.useEffect(() => {
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) setApiKey(savedKey);
    
    const savedSprintName = localStorage.getItem('currentSprintName');
    if (savedSprintName) setProjectName(savedSprintName);
  }, []);

  const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setProjectName(value);
    localStorage.setItem('currentSprintName', value);
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setApiKey(value);
    localStorage.setItem('openai_api_key', value);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleAiRewrite = async (setter: React.Dispatch<React.SetStateAction<{ id: string; text: string }[]>>, items: { id: string; text: string }[], index: number, fieldType: 'WHY' | 'WHAT' | 'HOW') => {
    if (!apiKey) {
      alert('⚠️ 請先於頁面頂部輸入您的 API Key，才能啟動魔法潤飾功能！');
      return;
    }

    const poIdea = data.poIdea.trim() || '';
    const newItems = [...items];
    const currentText = newItems[index].text.trim();
    
    setIsAiLoading(true);
    try {
      const response = await fetch('/api/ai-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, fieldType, currentText, poIdea })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || '後端請求失敗');
      }

      const resData = await response.json();
      newItems[index].text = resData.result || currentText;
      setter(newItems);
    } catch (err: unknown) {
      const e = err as Error;
      console.error('AI Rewrite Error:', e);
      alert('潤飾失敗：' + (e.message || '未知錯誤'));
    } finally {
      setIsAiLoading(false);
    }
  };

  const renderDynamicList = (items: { id: string; text: string }[], setter: React.Dispatch<React.SetStateAction<{ id: string; text: string }[]>>, placeholder: string, fieldType: 'WHY' | 'WHAT' | 'HOW') => {
    return (
      <div className="flex-1 flex flex-col gap-4">
        {items.map((item, index) => (
          <div key={item.id} className="flex gap-3 items-start group">
            <textarea 
              className="flex-1 px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner font-medium text-[#3e362e] transition-all" 
              placeholder={placeholder} 
              rows={2}
              value={item.text}
              onChange={(e) => {
                const newItems = [...items];
                newItems[index].text = e.target.value;
                setter(newItems);
              }}
            />
            <div className="flex flex-col gap-2 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => handleAiRewrite(setter, items, index, fieldType)}
                className="bg-[#f4e4e9] text-[#9b596f] px-3 py-2 rounded-lg text-xs font-bold hover:bg-[#eac4d0] border-2 border-[#d1a3b4] transition-all flex items-center justify-center shadow-sm"
                title="使用魔法讓描述更精準"
              >
                ✨ 魔法潤飾
              </button>
              {items.length > 1 && (
                <button 
                  onClick={() => setter(items.filter((_: { id: string; text: string }, i: number) => i !== index))}
                  className="bg-[#fceded] text-[#c96262] hover:bg-[#f7d7d7] px-3 py-2 rounded-lg border-2 border-[#e6b1b1] text-xs font-bold transition-all flex items-center justify-center shadow-sm"
                >
                  🧹 掃除
                </button>
              )}
            </div>
          </div>
        ))}
        <div>
          <button 
            onClick={() => setter([...items, { id: Date.now().toString(), text: '' }])}
            className="text-sm font-bold text-[#5b755e] hover:text-[#3d4f3f] flex items-center gap-1 px-4 py-2 bg-[#e8eedd] hover:bg-[#dcedc1] rounded-full border-2 border-[#a5c2a8] transition-all inline-flex shadow-sm"
          >
            🌱 播種新欄位
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#f4f1ea] p-8 font-serif text-[#3e362e] bg-[url('https://www.transparenttextures.com/patterns/rice-paper-2.png')]">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <Navigation />

        {/* API Key 設定區塊 */}
        <div className="bg-[#fffdf9] border-2 border-[#b5a695] p-4 rounded-xl shadow-sm flex flex-col md:flex-row items-center gap-4">
          <div className="font-bold text-[#8b5a2b] flex items-center gap-2 whitespace-nowrap">
            <span>🔑</span> AI 魔法鑰匙 (API Key)：
          </div>
          <input 
            type="password" 
            value={apiKey}
            onChange={handleApiKeyChange}
            className="flex-1 w-full px-4 py-2 bg-[#f4f1ea] border border-[#d3cbbd] rounded-lg focus:outline-none focus:border-[#8fb996] text-[#3e362e] font-sans"
            placeholder="請輸入您的 OpenAI API Key (sk-...)"
          />
          <div className="text-xs text-[#8a7f72]">
            * 您的金鑰僅會儲存於本地瀏覽器中
          </div>
        </div>

        {/* Header 專案基本資訊 */}
        <header className="bg-[#8fb996] border-4 border-[#5b755e] p-6 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-20 transform translate-x-4 -translate-y-4">
             <span className="text-9xl">🍃</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-4 relative z-10">
            <h1 className="text-3xl font-bold text-white drop-shadow-md whitespace-nowrap tracking-wider">專案名稱：</h1>
            <input 
              type="text" 
              value={projectName}
              onChange={handleProjectNameChange}
              className="flex-1 px-4 py-3 text-lg bg-[#fffdf9] border-2 border-[#5b755e] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner text-[#3e362e]"
              placeholder="請輸入專案名稱..."
            />
          </div>
        </header>

        {/* Loading Overlay */}
        {loading && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"><div className="bg-white px-6 py-4 rounded-xl font-bold text-[#5b755e] shadow-xl text-lg flex items-center gap-3"><span>💾</span> <span>載入資料中...</span></div></div>}

        {/* Sprint Planning 模組 */}
        <section className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-xl relative">
          <div className="bg-[#d4a373] border-b-4 border-[#5b755e] p-4 text-xl font-bold text-white tracking-wider flex items-center gap-2 drop-shadow-sm">
            <span>🍄</span> <ScrumTooltip keyword="Sprint Planning" text="Sprint Planning (Sprint 計畫)" />
          </div>
          
          <div className="p-6 space-y-6">
            {/* 基礎資訊 */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* 左側 3 個欄位 */}
              <div className="flex-1 flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-[#6b5e50]">目的</label>
                  <div className="px-4 py-3 bg-[#e8e4d9] border-2 border-[#b5a695] rounded-xl text-[#3e362e] shadow-inner font-medium">
                    建立共識並敲定行動計畫
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-[#6b5e50]">時間限制 (TIME)</label>
                  <select className="px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner font-medium text-[#3e362e]" value={data.timeLimit} onChange={e => updateData({ timeLimit: e.target.value })}> 
                    <option value="1">1 週 (≤ 2 小時)</option>
                    <option value="2">2 週 (≤ 4 小時)</option>
                    <option value="3">3 週 (≤ 6 小時)</option>
                    <option value="4">4 週 (≤ 8 小時)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-bold text-[#6b5e50]">開始日</label>
                  <input type="date" value={data.startDate} onChange={e => updateData({ startDate: e.target.value })} className="px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner font-medium text-[#3e362e]" />
                </div>
              </div>

              {/* 右側：與會人 */}
              <div className="flex-1 flex flex-col gap-2">
                <label className="font-bold text-[#6b5e50]">與會人</label>
                <div className="px-4 py-3 bg-[#e8e4d9] border-2 border-[#b5a695] rounded-xl text-[#3e362e] shadow-inner font-medium flex-1">
                  <div className="flex flex-col gap-4 justify-around h-full">
                    <div className="flex items-center gap-2">
                      <div className="w-32 flex-shrink-0"><ScrumTooltip keyword="PO" text="Product Owner" /></div>
                      <span>:</span>
                      <input type="text" value={data.po || ''} onChange={e => updateData({ po: e.target.value })} className="flex-1 min-w-0 bg-transparent border-b-2 border-[#b5a695] focus:border-[#8fb996] outline-none placeholder-[#8a7f72]" placeholder="PO姓名" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-32 flex-shrink-0"><ScrumTooltip keyword="SM" text="Scrum Master" /></div>
                      <span>:</span>
                      <input type="text" value={data.sm || ''} onChange={e => updateData({ sm: e.target.value })} className="flex-1 min-w-0 bg-transparent border-b-2 border-[#b5a695] focus:border-[#8fb996] outline-none placeholder-[#8a7f72]" placeholder="SM姓名" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-32 flex-shrink-0"><ScrumTooltip keyword="DEVS" text="開發團隊" /></div>
                      <span>:</span>
                      <input type="text" value={data.devs || ''} onChange={e => updateData({ devs: e.target.value })} className="flex-1 min-w-0 bg-transparent border-b-2 border-[#b5a695] focus:border-[#8fb996] outline-none placeholder-[#8a7f72]" placeholder="DEVS名單" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-32 flex-shrink-0 pl-1">其他</div>
                      <span>:</span>
                      <input type="text" value={data.stakeholders} onChange={e => updateData({ stakeholders: e.target.value })} className="flex-1 min-w-0 bg-transparent border-b-2 border-[#b5a695] focus:border-[#8fb996] outline-none placeholder-[#8a7f72]" placeholder="利益關係人、專家" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-bold text-[#6b5e50]">初步想法 (PO提出)</label>
              <textarea 
                value={data.poIdea}
                onChange={e => updateData({ poIdea: e.target.value })}
                rows={2} 
                className="w-full px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner font-medium text-[#3e362e]"
                placeholder="請輸入初步想法..."
              />
            </div>

            {/* 核心規劃矩陣 */}
            <div className="mt-8 border-t-2 border-[#d3cbbd] pt-8">
              <h3 className="font-bold text-2xl mb-6 text-[#5b755e] flex items-center gap-2">
                <span>🌱</span> 核心規劃矩陣
              </h3>
              
              <div className="space-y-6">
                
                {/* WHY */}
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="lg:w-64 bg-[#f2e3c6] p-4 flex flex-col items-center justify-center border-2 border-[#d4a373] rounded-2xl text-center shrink-0 shadow-sm relative">
                    <div className="absolute -bottom-2 -right-2 text-4xl opacity-20">☀️</div>
                    <div className="font-bold text-2xl mb-2 text-[#8b5a2b]"><ScrumTooltip keyword="WHY" text="WHY" /></div>
                    <div className="text-sm font-bold text-[#6b5e50]">[為什麼這個 Sprint 有價值？]</div>
                    <div className="text-sm font-bold text-[#4a7c59] mt-1">[驗證技術可行性]</div>
                  </div>
                  {renderDynamicList(data.whys, (newItems) => updateData({ whys: typeof newItems === 'function' ? newItems(data.whys) : newItems }), "請輸入價值描述...", 'WHY')}
                </div>

                {/* WHAT */}
                <div className="flex flex-col lg:flex-row gap-4 mt-6">
                  <div className="lg:w-64 bg-[#dcedc1] p-4 flex flex-col items-center justify-center border-2 border-[#8fb996] rounded-2xl text-center shrink-0 shadow-sm relative">
                    <div className="absolute -bottom-2 -left-2 text-4xl opacity-20">🌲</div>
                    <div className="font-bold text-2xl mb-2 text-[#5b755e]"><ScrumTooltip keyword="WHAT" text="WHAT" /></div>
                    <div className="text-sm font-bold text-[#6b5e50]">[這個 Sprint 能完成什麼？]</div>
                    <div className="text-sm font-bold text-[#4a7c59] mt-1">[具體化的功能模組]</div>
                    <div className="text-sm font-bold text-[#c06c55] mt-1">(Sprint Backlog基礎)</div>
                  </div>
                  {renderDynamicList(data.whats, (newItems) => updateData({ whats: typeof newItems === 'function' ? newItems(data.whats) : newItems }), "請輸入具體功能模組...", 'WHAT')}
                </div>

                {/* HOW */}
                <div className="flex flex-col lg:flex-row gap-4 mt-6">
                  <div className="lg:w-64 bg-[#c2dce3] p-4 flex flex-col items-center justify-center border-2 border-[#76a5af] rounded-2xl text-center shrink-0 shadow-sm relative">
                    <div className="absolute -top-2 -right-2 text-4xl opacity-20">☁️</div>
                    <div className="font-bold text-2xl mb-2 text-[#467386]"><ScrumTooltip keyword="HOW" text="HOW" /></div>
                    <div className="text-sm font-bold text-[#6b5e50]">[工作將如何完成？]</div>
                    <div className="text-sm font-bold text-[#4a7c59] mt-1">[思考如何串接這些工具]</div>
                  </div>
                  {renderDynamicList(data.hows, (newItems) => updateData({ hows: typeof newItems === 'function' ? newItems(data.hows) : newItems }), "請輸入工作方式與工具...", 'HOW')}
                </div>

              </div>
            </div>

            <div className="flex justify-end pt-8">
              <Link href="/backlog" className="bg-[#e07a5f] text-white px-8 py-3 rounded-full font-bold text-lg hover:bg-[#c66147] hover:-translate-y-1 transition-all duration-200 shadow-lg border-2 border-[#8a4231] inline-block text-center flex items-center gap-2">
                <span>🚂</span> 儲存計畫並前往 Backlog
              </Link>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
