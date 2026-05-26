"use client";
import React, { useState } from 'react';
import { useAutoSave } from '@/hooks/useAutoSave';
import Link from 'next/link';

import Navigation from '@/components/Navigation';
import ScrumTooltip from '@/components/ScrumTooltip';
import { planningToSprintPlanning, isShallowEqualJSON, type RightPlanning } from '@/lib/planningSync';

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [projectName, setProjectName] = useState('');

  const [orgTeam, setOrgTeam] = React.useState<{ id: string; name: string; role: string }[]>([]);
  const [showDevPicker, setShowDevPicker] = React.useState(false);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('orgTeamMembers');
      if (raw) setOrgTeam(JSON.parse(raw));
    } catch {}
  }, []);

  const { data, updateData, loading } = useAutoSave('planning', {
    poIdea: '',
    timeLimit: '2',
    startDate: '',
    stakeholders: '',
    po: '',
    sm: '',
    devs: '',
    devsList: [{ id: '1', name: '', role: '' }] as { id: string; name: string; role: string }[],
    whys: [{ id: '1', text: '' }],
    whats: [{ id: '1', text: '' }],
    hows: [{ id: '1', text: '' }]
  });

  // 舊資料相容：若 devsList 還是空但 devs 字串有內容，從字串拆出列表
  const devsHydratedRef = React.useRef(false);
  React.useEffect(() => {
    if (loading || devsHydratedRef.current) return;
    const list = data.devsList || [];
    const hasContent = list.some(d => (d.name || '').trim() || (d.role || '').trim());
    if (!hasContent && (data.devs || '').trim()) {
      const names = data.devs.split(/[,、，\n]/).map(s => s.trim()).filter(Boolean);
      if (names.length > 0) {
        updateData({
          devsList: names.map((name, i) => ({ id: `${Date.now()}-${i}`, name, role: '' }))
        });
      }
    }
    devsHydratedRef.current = true;
  }, [loading, data.devs, data.devsList, updateData]);

  const syncDevsString = (list: { id: string; name: string; role: string }[]) => {
    const joined = list.map(d => d.name.trim()).filter(Boolean).join(',');
    updateData({ devsList: list, devs: joined });
  };

  const updateDev = (index: number, field: 'name' | 'role', value: string) => {
    const list = [...(data.devsList || [])];
    list[index] = { ...list[index], [field]: value };
    syncDevsString(list);
  };

  const addDev = () => {
    const list = [...(data.devsList || []), { id: Date.now().toString(), name: '', role: '' }];
    syncDevsString(list);
  };

  const removeDev = (index: number) => {
    const list = (data.devsList || []).filter((_, i) => i !== index);
    syncDevsString(list.length > 0 ? list : [{ id: Date.now().toString(), name: '', role: '' }]);
  };

  // 元件載入時讀取 API Key 與 專案名稱
  React.useEffect(() => {
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) setApiKey(savedKey);

    const savedSprintName = localStorage.getItem('currentSprintName');
    if (savedSprintName) setProjectName(savedSprintName);
  }, []);

  // Mirror: planning → sprintPlanning（scrum-project-new 用的 schema）
  // 用 1.5s debounce + 內容相等檢查避免迴圈寫入
  // 優先從 Firestore users/{uid}.currentSprintId 取得 sprintId，解決不同 port localStorage 不同步問題
  React.useEffect(() => {
    if (loading) return;
    const localSprintId = typeof window !== 'undefined' ? localStorage.getItem('currentSprintId') : null;
    if (!localSprintId) return;
    const timer = setTimeout(async () => {
      try {
        const { doc, getDoc, setDoc, getAuth } = await import('firebase/firestore').then(async (fs) => {
          const auth = await import('firebase/auth');
          return { ...fs, getAuth: auth.getAuth };
        });
        const { db, app } = await import('@/lib/firebase');
        const auth = getAuth(app);

        // 用 Firestore users/{uid}.currentSprintId 作為跨 port 共用的 sprintId
        let sprintId = localSprintId;
        if (auth.currentUser) {
          try {
            const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const fsSprintId = userSnap.exists() ? userSnap.data().currentSprintId : null;
            if (fsSprintId) sprintId = fsSprintId;
          } catch {}
        }

        const ref = doc(db, 'sprints', sprintId);
        const snap = await getDoc(ref);
        const existing = snap.exists() ? snap.data().sprintPlanning : undefined;
        const mapped = planningToSprintPlanning(data as RightPlanning, existing);
        if (isShallowEqualJSON(existing, mapped)) return;
        await setDoc(ref, { sprintPlanning: mapped }, { merge: true });
      } catch (err) {
        console.warn('[planningSync] mirror to sprintPlanning failed', err);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [data, loading]);

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

  const [aiLoadingKey, setAiLoadingKey] = useState<string | null>(null);

  const handleAiRewrite = async (setter: React.Dispatch<React.SetStateAction<{ id: string; text: string }[]>>, items: { id: string; text: string }[], index: number, fieldType: 'WHY' | 'WHAT' | 'HOW') => {
    if (!apiKey) {
      alert('⚠️ 請先於頁面頂部輸入您的 API Key，才能啟動魔法潤飾功能！');
      return;
    }

    const poIdea = data.poIdea.trim() || '';
    const newItems = [...items];
    const currentText = newItems[index].text.trim();

    const members = {
      po: data.po || '',
      sm: data.sm || '',
      devs: data.devs || '',
      stakeholders: data.stakeholders || ''
    };

    const loadingKey = `${fieldType}-${items[index].id}`;
    setAiLoadingKey(loadingKey);
    try {
      const response = await fetch('/api/ai-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, fieldType, currentText, poIdea, members })
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
      setAiLoadingKey(null);
    }
  };

  const renderDynamicList = (items: { id: string; text: string }[], setter: React.Dispatch<React.SetStateAction<{ id: string; text: string }[]>>, placeholder: string, fieldType: 'WHY' | 'WHAT' | 'HOW') => {
    return (
      <div className="flex-1 flex flex-col gap-4">
        {items.map((item, index) => {
          const itemLoadingKey = `${fieldType}-${item.id}`;
          const isThisLoading = aiLoadingKey === itemLoadingKey;
          const isAnyLoading = aiLoadingKey !== null;
          return (
          <div key={item.id} className="flex gap-3 items-start group">
            <div className={`flex-1 relative transition-opacity ${isThisLoading ? 'opacity-70' : ''}`}>
              <textarea
                className="w-full px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner font-medium text-[#3e362e] transition-all disabled:cursor-wait"
                placeholder={placeholder}
                rows={2}
                value={item.text}
                disabled={isThisLoading}
                onChange={(e) => {
                  const newItems = [...items];
                  newItems[index].text = e.target.value;
                  setter(newItems);
                }}
              />
              {isThisLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px] rounded-xl pointer-events-none">
                  <div className="flex items-center gap-2 bg-[#fffdf9] border-2 border-[#d1a3b4] text-[#9b596f] font-bold px-3 py-1.5 rounded-full shadow-sm text-sm">
                    <span className="inline-block w-3 h-3 border-2 border-[#d1a3b4] border-t-transparent rounded-full animate-spin"></span>
                    <span>✨ 潤飾中...</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleAiRewrite(setter, items, index, fieldType)}
                disabled={isAnyLoading}
                aria-busy={isThisLoading}
                className={`px-3 py-2 rounded-lg text-xs font-bold border-2 transition-all flex items-center justify-center gap-1 shadow-sm min-w-[88px]
                  ${isThisLoading
                    ? 'bg-[#eac4d0] text-[#9b596f] border-[#d1a3b4] cursor-wait'
                    : 'bg-[#f4e4e9] text-[#9b596f] hover:bg-[#eac4d0] border-[#d1a3b4]'}
                  ${isAnyLoading && !isThisLoading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                title={isThisLoading ? '正在請 AI 潤飾，請稍候' : '使用魔法讓描述更精準'}
              >
                {isThisLoading ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-[#9b596f] border-t-transparent rounded-full animate-spin"></span>
                    <span>潤飾中</span>
                  </>
                ) : (
                  <>✨ 魔法潤飾</>
                )}
              </button>
              {items.length > 1 && (
                <button
                  onClick={() => setter(items.filter((_: { id: string; text: string }, i: number) => i !== index))}
                  disabled={isThisLoading}
                  className="bg-[#fceded] text-[#c96262] hover:bg-[#f7d7d7] px-3 py-2 rounded-lg border-2 border-[#e6b1b1] text-xs font-bold transition-all flex items-center justify-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🧹 掃除
                </button>
              )}
            </div>
          </div>
          );
        })}
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
                  <select className="px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner font-medium text-[#3e362e]" value={data.timeLimit} onChange={e => {
                    const val = e.target.value;
                    updateData({ timeLimit: val });
                    const days = val === '30d' ? 30 : Number(val) * 7;
                    if (days > 0) localStorage.setItem('sprintDays', String(days));
                  }}>
                    <option value="1">1 週 (≤ 2 小時)</option>
                    <option value="2">2 週 (≤ 4 小時)</option>
                    <option value="3">3 週 (≤ 6 小時)</option>
                    <option value="4">4 週 (≤ 8 小時)</option>
                    <option value="30d">30 天 (≤ 8 小時)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-bold text-[#6b5e50]">開始日</label>
                  <input type="date" value={data.startDate} onChange={e => updateData({ startDate: e.target.value })} className="px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner font-medium text-[#3e362e]" />
                </div>
              </div>

              {/* 右側：與會人 */}
              <div className="flex-1 flex flex-col gap-4">
                <label className="font-bold text-[#6b5e50]">與會人</label>

                {/* datalist for member suggestions */}
                <datalist id="org-members-list">
                  {orgTeam.map(m => <option key={m.id} value={m.name} />)}
                </datalist>

                {/* PO / SM */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-bold text-[#6b5e50]"><ScrumTooltip keyword="PO" text="Product Owner" /> <span className="text-[#c96262]">*</span></div>
                    <input list="org-members-list" type="text" value={data.po || ''} onChange={e => updateData({ po: e.target.value })} className="px-3 py-2 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner text-[#3e362e]" placeholder={orgTeam.length > 0 ? '輸入或從成員庫選取...' : 'PO 姓名'} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-bold text-[#6b5e50]"><ScrumTooltip keyword="SM" text="Scrum Master" /> <span className="text-[#c96262]">*</span></div>
                    <input list="org-members-list" type="text" value={data.sm || ''} onChange={e => updateData({ sm: e.target.value })} className="px-3 py-2 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner text-[#3e362e]" placeholder={orgTeam.length > 0 ? '輸入或從成員庫選取...' : 'SM 姓名'} />
                  </div>
                </div>

                {/* 開發團隊 */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-[#6b5e50]"><ScrumTooltip keyword="DEVS" text="開發團隊" /></div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-[#8a7f72]">{(data.devsList || []).filter(d => (d.name || '').trim()).length} 位</div>
                      {orgTeam.length > 0 && (
                        <button
                          onClick={() => setShowDevPicker(prev => !prev)}
                          className="text-xs font-bold text-[#5b755e] hover:text-[#3d4f3f] bg-[#e8eedd] hover:bg-[#dcedc1] px-2 py-0.5 rounded-full border border-[#a5c2a8] transition-all"
                        >
                          ⚡ 從成員庫選
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 成員庫快選面板 */}
                  {showDevPicker && orgTeam.length > 0 && (
                    <div className="bg-[#f4f1ea] border-2 border-[#a5c2a8] rounded-xl p-3 flex flex-wrap gap-2">
                      {orgTeam.map(m => {
                        const alreadyAdded = (data.devsList || []).some(d => d.name === m.name);
                        return (
                          <button
                            key={m.id}
                            onClick={() => {
                              if (alreadyAdded) return;
                              const list = [...(data.devsList || []).filter(d => (d.name || '').trim()), { id: Date.now().toString(), name: m.name, role: m.role }];
                              syncDevsString(list);
                            }}
                            disabled={alreadyAdded}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border-2 transition-all
                              ${alreadyAdded
                                ? 'bg-[#8fb996] border-[#5b755e] text-white cursor-default'
                                : 'bg-white border-[#a5c2a8] text-[#3e362e] hover:bg-[#dcedc1] hover:border-[#5b755e]'
                              }`}
                            title={alreadyAdded ? '已加入' : `加入 ${m.name}`}
                          >
                            <span className="w-5 h-5 rounded-full bg-[#8fb996] text-white text-xs flex items-center justify-center flex-shrink-0">{(m.name || '?').slice(0, 1)}</span>
                            {m.name}{m.role ? <span className="font-normal opacity-70">・{m.role}</span> : null}
                            {alreadyAdded && <span className="text-white text-xs">✓</span>}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setShowDevPicker(false)}
                        className="text-xs text-[#8a7f72] hover:text-[#3e362e] px-2 py-1 ml-auto"
                      >
                        收起
                      </button>
                    </div>
                  )}

                  <div className="bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl shadow-inner divide-y-2 divide-[#e8e4d9]">
                    {(data.devsList || []).map((dev, i) => (
                      <div key={dev.id} className="flex items-center gap-2 px-3 py-2">
                        <input
                          type="text"
                          value={dev.name}
                          onChange={e => updateDev(i, 'name', e.target.value)}
                          className="flex-1 min-w-0 bg-transparent border-b-2 border-transparent focus:border-[#8fb996] outline-none text-[#3e362e] placeholder-[#a89e92]"
                          placeholder="姓名"
                        />
                        <input
                          type="text"
                          value={dev.role}
                          onChange={e => updateDev(i, 'role', e.target.value)}
                          className="w-32 bg-transparent border-b-2 border-transparent focus:border-[#8fb996] outline-none text-sm text-[#6b5e50] placeholder-[#a89e92]"
                          placeholder="角色（例：Tech Lead）"
                        />
                        <button
                          onClick={() => removeDev(i)}
                          className="text-[#c96262] hover:bg-[#fceded] px-2 py-1 rounded text-sm shrink-0"
                          title="移除這位成員"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addDev}
                    className="self-start text-sm font-bold text-[#5b755e] hover:text-[#3d4f3f] flex items-center gap-1 px-3 py-1.5 bg-[#e8eedd] hover:bg-[#dcedc1] rounded-full border-2 border-[#a5c2a8] transition-all shadow-sm"
                  >
                    ＋ 新增成員
                  </button>
                </div>

                {/* 利害關係人 / 專家 */}
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-bold text-[#6b5e50]">利害關係人 / 專家（選填）</div>
                  <textarea
                    value={data.stakeholders}
                    onChange={e => updateData({ stakeholders: e.target.value })}
                    rows={3}
                    className="px-3 py-2 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner text-[#3e362e] resize-none"
                    placeholder="一行一位，例如：&#10;陳副總（主要贊助人）&#10;Globex IT 部門（客戶代表）"
                  />
                  <div className="text-xs text-[#8a7f72]">一行一位，可加註角色，例如「王經理（客戶代表）」</div>
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
