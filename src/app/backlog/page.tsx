"use client";
import React, { useState, useEffect } from 'react';
import { useAutoSave } from '@/hooks/useAutoSave';
import Navigation from '@/components/Navigation';
import ScrumTooltip from '@/components/ScrumTooltip';

interface Task {
  id: string;
  type: 'pbi' | 'task';
  status: 'pbi' | 'todo' | 'doing' | 'done' | 'accepted';
  title: string;
  desc?: string;
  role?: string;
  time?: string;
  pbiId?: string;
}

const initialTasks: Task[] = [];

export default function Backlog() {
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const { data, updateData, loading } = useAutoSave('backlog', {
    sprintDays: 30 as number | string,
    tasks: initialTasks,
    sprintGoal: '',
    stakeholders: ''
  });

  const sprintDays = data.sprintDays;
  const tasks = data.tasks;
  const setTasks = (valOrFn: Task[] | ((prev: Task[]) => Task[])) => {
    if (typeof valOrFn === 'function') {
      updateData({ tasks: valOrFn(data.tasks) });
    } else {
      updateData({ tasks: valOrFn });
    }
  };

  useEffect(() => {
    if (sprintDays) {
      localStorage.setItem('sprintDays', sprintDays.toString());
    }
  }, [sprintDays]);

  
  useEffect(() => {
    if (loading) return;

    const syncWhatsFromPlanning = async () => {
      try {
        const sprintId = localStorage.getItem('currentSprintId');
        if (!sprintId) return;

        const { getAuth } = await import('firebase/auth');
        const { doc, getDoc, setDoc } = await import('firebase/firestore');
        const { db, app } = await import('@/lib/firebase');
        const auth = getAuth(app);

        // 如果是分享連結的檢視者，跳過從 users 讀取
        const isPublicViewer = localStorage.getItem('sprintRole_' + sprintId) === 'viewer_via_link';
        
        let planningData = null;
        if (auth.currentUser || isPublicViewer) {
          const docRef = doc(db, 'sprints', sprintId);
          const snap = await getDoc(docRef);
          if (snap.exists() && snap.data().planning) {
            planningData = snap.data().planning;
          }
        } else {
          const localStr = localStorage.getItem(`sprint_${sprintId}_planning`);
          if (localStr) planningData = JSON.parse(localStr);
        }

        if (planningData && planningData.whats) {
          const whats = planningData.whats.filter((w: any) => w.text && w.text.trim() !== '');
          
          setTasks(prev => {
            let newTasks = [...prev];
            let changed = false;
            
            // 1. 同步 Planning 新增或修改的 WHAT
            whats.forEach((w: any, index: number) => {
              const existingIndex = newTasks.findIndex(t => t.id === w.id);
              if (existingIndex >= 0) {
                if (newTasks[existingIndex].title !== w.text) {
                  newTasks[existingIndex] = { ...newTasks[existingIndex], title: w.text };
                  changed = true;
                }
              } else {
                newTasks.push({
                  id: w.id,
                  type: 'pbi',
                  status: 'pbi',
                  title: w.text
                });
                changed = true;
              }
            });

            // 2. 移除在 Planning 中已被刪除的 WHAT
            const whatIds = whats.map((w: any) => w.id);
            const tasksToRemove = newTasks.filter(t => t.type === 'pbi' && !whatIds.includes(t.id));
            if (tasksToRemove.length > 0) {
              newTasks = newTasks.filter(t => t.type !== 'pbi' || whatIds.includes(t.id));
              changed = true;
            }

            // 3. 確保順序與 Planning 的 WHAT 一致
            const pbis = newTasks.filter(t => t.type === 'pbi');
            const others = newTasks.filter(t => t.type !== 'pbi');
            pbis.sort((a, b) => {
              const idxA = whats.findIndex((w: any) => w.id === a.id);
              const idxB = whats.findIndex((w: any) => w.id === b.id);
              return idxA - idxB;
            });
            
            const orderedTasks = [...pbis, ...others];
            
            // 檢查順序是否改變
            const orderChanged = orderedTasks.map(t=>t.id).join(',') !== newTasks.map(t=>t.id).join(',');

            if (changed || orderChanged) {
              return orderedTasks;
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("Sync PBI failed:", err);
      }
    };
    
    syncWhatsFromPlanning();
    
    // 設定每 5 秒同步一次以達成類似即時的效果
    const interval = setInterval(syncWhatsFromPlanning, 5000);
    return () => clearInterval(interval);
  }, [loading]);


  useEffect(() => {
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const handleAiGenerateTasks = async (pbiId: string, pbiTitle: string) => {
    if (!apiKey) {
      alert('⚠️ 請先於頁面設定 API Key (OpenAI 或 Gemini 均可)，才能啟動 AI 拆解任務功能！');
      return;
    }
    setIsAiLoading(true);
    try {
      let aiContent = '';
      const prompt = `你是一個專業的 Scrum Master 與資深開發者。請幫我將以下 Product Backlog Item (PBI) 拆解成 3 到 5 個具體的 Task (待辦任務)。以 JSON 陣列格式回傳，每個任務包含 title (標題) 與 desc (簡短描述)。不要回傳 Markdown 標籤，直接回傳 JSON 陣列即可。例如：[{"title":"建立資料表", "desc":"建立 users 資料表"}]\n\nPBI: ${pbiTitle}`;

      if (apiKey.startsWith('AIza')) {
        // 使用 Google Gemini API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7 }
          })
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.error("Gemini API Error details:", errData);
          throw new Error('Gemini API 請求失敗: ' + (errData?.error?.message || response.statusText));
        }
        const data = await response.json();
        aiContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        // 使用 OpenAI API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "你是一個專業的 Scrum Master 與資深開發者。請幫我將以下 Product Backlog Item (PBI) 拆解成 3 到 5 個具體的 Task (待辦任務)。以 JSON 陣列格式回傳，每個任務包含 title (標題) 與 desc (簡短描述)。不要回傳 Markdown 標籤，直接回傳 JSON 陣列即可。例如：[{\"title\":\"建立資料表\", \"desc\":\"建立 users 資料表\"}]" },
              { role: "user", content: `PBI: ${pbiTitle}` }
            ],
            temperature: 0.7,
          })
        });
        if (!response.ok) throw new Error('OpenAI API 請求失敗');
        const data = await response.json();
        aiContent = data.choices?.[0]?.message?.content || '';
      }
      
      // 擷取 JSON 陣列部分 (處理 AI 可能會加上 "好的，這是結果：" 等前言)
      const startIdx = aiContent.indexOf('[');
      const endIdx = aiContent.lastIndexOf(']');
      if (startIdx !== -1 && endIdx !== -1) {
        aiContent = aiContent.substring(startIdx, endIdx + 1);
      }
      
      let parsedTasks = [];
      try {
        parsedTasks = JSON.parse(aiContent);
      } catch (parseErr) {
        console.error("JSON 解析失敗，原始字串為:", aiContent);
        throw new Error("AI 回傳的格式不正確，無法解析為 JSON");
      }
      
      setTasks((prev) => {
        const newTasks = parsedTasks.map((t: any, i: number) => ({
          id: `task-${Date.now()}-${i}`,
          type: 'task',
          status: 'todo',
          title: t.title,
          desc: t.desc,
          role: '',
          time: '',
          pbiId: pbiId
        }));
        return [...newTasks, ...prev];
      });
      
    } catch (err: any) {
      console.error('AI Generate Error:', err);
      alert('產生失敗：' + (err.message || '未知錯誤') + '\n請確認 API Key 是否有效，或查看 Console 了解詳細錯誤。');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      updateData({ sprintDays: '' });
      setErrorMsg('');
      return;
    }
    
    const num = Number(value);
    if (num > 30) {
      updateData({ sprintDays: 30 });
      setErrorMsg('⚠️ 週期天數絕對不能超過 30 天！已為您限制為 30 天。');
      localStorage.setItem('sprintDays', '30');
    } else if (num < 1) {
      updateData({ sprintDays: 1 });
      setErrorMsg('');
      localStorage.setItem('sprintDays', '1');
    } else {
      updateData({ sprintDays: num });
      setErrorMsg('');
      localStorage.setItem('sprintDays', num.toString());
    }
  };

  const onDragStart = (e: React.DragEvent, task: Task) => {
    if (editingTaskId === task.id) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.setData('taskType', task.type);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Required to allow dropping
  };

  
  const onDrop = (e: React.DragEvent, targetStatus: Task['status'], targetTaskId?: string, targetPbiId?: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('taskId');
    if (!id) return;
    
    setTasks((prevTasks: Task[]) => {
      const taskIndex = prevTasks.findIndex(t => t.id === id);
      if (taskIndex === -1) return prevTasks;
      
      const task = prevTasks[taskIndex];
      
      // 限制 1：PBI 不能移動到別的欄位，只能在 pbi 或 accepted 欄位互換
      if (task.type === 'pbi' && targetStatus !== 'pbi' && targetStatus !== 'accepted') {
        return prevTasks; 
      }
      
      // 限制 2：任務不能移動到 PBI 欄位
      if (task.type === 'task' && (targetStatus === 'pbi' || targetStatus === 'accepted')) {
        return prevTasks; 
      }
      
      const newTasks = [...prevTasks];
      
      // 更新狀態與歸屬 PBI
      const updatedTask = { ...task, status: targetStatus };
      
      // 如果拖曳到特定的 PBI 區塊中，自動將此任務歸屬給該 PBI
      if (task.type === 'task' && targetPbiId !== undefined) {
         updatedTask.pbiId = targetPbiId === 'unassigned' ? undefined : targetPbiId;
      }
      
      newTasks[taskIndex] = updatedTask;
      
      // 處理同欄位內的排序 (例如上下移動)
      if (targetTaskId) {
        const targetIndex = newTasks.findIndex(t => t.id === targetTaskId);
        if (targetIndex !== -1 && taskIndex !== targetIndex) {
          const [removed] = newTasks.splice(taskIndex, 1);
          newTasks.splice(targetIndex, 0, removed);
        }
      }
      
      return newTasks;
    });
  };

  const deleteTask = (id: string) => {
    setTasks((prev: Task[]) => prev.filter(t => t.id !== id));
  };


  const moveTask = (id: string, direction: number) => {
    setTasks((prev: Task[]) => {
      const index = prev.findIndex((t) => t.id === id);
      if (index === -1) return prev;
      const newTasks = [...prev];
      const task = newTasks[index];

      const groupTasks = newTasks.filter(
        (t) =>
          t.status === task.status &&
          t.type === task.type &&
          t.pbiId === task.pbiId
      );

      const groupIndex = groupTasks.findIndex((t) => t.id === id);
      if (direction === -1 && groupIndex > 0) {
        const targetId = groupTasks[groupIndex - 1].id;
        const targetIndex = newTasks.findIndex((t) => t.id === targetId);
        newTasks.splice(index, 1);
        newTasks.splice(targetIndex, 0, task);
      } else if (direction === 1 && groupIndex < groupTasks.length - 1) {
        const targetId = groupTasks[groupIndex + 1].id;
        const targetIndex = newTasks.findIndex((t) => t.id === targetId);
        newTasks.splice(index, 1);
        newTasks.splice(targetIndex, 0, task);
      }
      return newTasks;
    });
  };

  const updateTask = (id: string, field: keyof Task, value: string) => {
    setTasks((prev: Task[]) => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  
  const renderTasks = (status: Task['status'], pbiId?: string) => {
    // If we're rendering a specific PBI group, only show tasks belonging to it
    // If pbiId === 'unassigned', show tasks with no pbiId
    let filteredTasks = tasks.filter(t => t.status === status);
    
    if (status !== 'pbi' && status !== 'accepted') {
       if (pbiId === 'unassigned') {
         filteredTasks = filteredTasks.filter(t => !t.pbiId);
       } else if (pbiId) {
         filteredTasks = filteredTasks.filter(t => t.pbiId === pbiId);
       }
    }
    
    if (filteredTasks.length === 0) {
      if (status === 'pbi' || status === 'accepted') {
        return (
          <div className="flex items-center justify-center h-full text-[#8a7f72] text-sm font-bold border-4 border-dashed border-[#b5a695] rounded-2xl m-2 bg-[#fffdf9]/50 min-h-[150px]">
            <span>{status === 'accepted' ? '🍃 拖曳任務至此' : '🪹 尚無項目'}</span>
          </div>
        );
      } else {
        return (
          <div 
             className="flex items-center justify-center h-full text-[#b5a695]/50 text-xs font-bold border-2 border-dashed border-[#b5a695]/30 rounded-xl m-2 min-h-[80px]"
             onDragOver={onDragOver}
             onDrop={(e) => {
                e.stopPropagation();
                onDrop(e, status, undefined, pbiId);
             }}
          >
            <span>拖曳至此</span>
          </div>
        );
      }
    }

    return filteredTasks.map(task => {
      const isEditing = editingTaskId === task.id;

      return (
        <div 
          key={task.id}
          draggable={!isEditing}
          onDragStart={(e) => onDragStart(e, task)}
          onDragOver={onDragOver}
          onDrop={(e) => {
            e.stopPropagation(); // 避免觸發外層欄位的 drop
            onDrop(e, status, task.id, pbiId);
          }}
          className={`bg-[#fffdf9] border-2 p-4 rounded-xl shadow-sm transition-all group relative
            ${task.type === 'pbi' ? 'border-[#d4a373] bg-[#f2e3c6] hover:bg-[#faebce]' : 'border-[#b5a695] hover:border-[#c96262]'}
            ${task.status === 'doing' ? 'border-l-8 border-l-[#d4a373]' : ''}
            ${!isEditing ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : 'shadow-md'}
          `}
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-3">
            <span className={`text-[10px] font-bold px-2 py-1 rounded-md border 
              ${task.type === 'pbi' ? 'text-[#8b5a2b] bg-[#faebce] border-[#d4a373]' : 'text-[#c96262] bg-[#fceded] border-[#e6b1b1]'}`}>
              {task.type === 'pbi' ? 'PBI' : '任務'}
            </span>
            
            {!isEditing && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 absolute top-2 right-2 bg-white/80 p-1 rounded-lg shadow-sm z-10">
                <button onClick={() => moveTask(task.id, -1)} className="text-gray-500 hover:text-gray-700 bg-gray-50 p-1.5 rounded-md text-xs font-bold" title="向上排序">🔼</button>
                <button onClick={() => moveTask(task.id, 1)} className="text-gray-500 hover:text-gray-700 bg-gray-50 p-1.5 rounded-md text-xs font-bold" title="向下排序">🔽</button>
                <button onClick={() => setEditingTaskId(task.id)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded-md" title="編輯">✏️</button>
                <button onClick={() => deleteTask(task.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-md" title="刪除">🗑️</button>
              </div>
            )}
          </div>

          {/* Body */}
          {isEditing ? (
            <div className="space-y-2 mt-2">
              <input 
                type="text" 
                value={task.title} 
                onChange={(e) => updateTask(task.id, 'title', e.target.value)}
                className="w-full text-sm font-bold p-2 border-2 border-[#b5a695] rounded focus:outline-none focus:border-[#5b755e]"
                placeholder={task.type === 'pbi' ? "PBI 標題" : "任務標題"}
              />
              <textarea 
                value={task.desc || ''} 
                onChange={(e) => updateTask(task.id, 'desc', e.target.value)}
                className="w-full text-xs p-2 border-2 border-[#b5a695] rounded focus:outline-none focus:border-[#5b755e]"
                placeholder={task.type === 'pbi' ? "PBI 描述說明 (選填)" : "任務詳細說明 (選填)"}
                rows={3}
              />
              {task.type === 'task' && (
                <>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={task.role || ''} 
                    onChange={(e) => updateTask(task.id, 'role', e.target.value)}
                    className="w-1/2 text-xs p-2 border-2 border-[#b5a695] rounded focus:outline-none focus:border-[#5b755e]"
                    placeholder="負責人"
                  />
                  <input 
                    type="text" 
                    value={task.time || ''} 
                    onChange={(e) => updateTask(task.id, 'time', e.target.value)}
                    className="w-1/2 text-xs p-2 border-2 border-[#b5a695] rounded focus:outline-none focus:border-[#5b755e]"
                    placeholder="預估工時 (例: 4h)"
                  />
                </div>
                <div>
                   <select 
                     value={task.pbiId || ''} 
                     onChange={(e) => updateTask(task.id, 'pbiId', e.target.value)}
                     className="w-full text-xs p-2 border-2 border-[#b5a695] rounded focus:outline-none focus:border-[#5b755e] bg-white text-[#6b5e50]"
                   >
                     <option value="">(無歸屬 PBI)</option>
                     {tasks.filter(t => t.type === 'pbi').map(pbi => (
                        <option key={pbi.id} value={pbi.id}>{pbi.title.substring(0,20)}{pbi.title.length > 20 ? '...' : ''}</option>
                     ))}
                   </select>
                </div>
                </>
              )}
              <div className="flex gap-2 pt-1">
                <button 
                  onClick={() => {
                    if (!task.title.trim()) {
                      updateTask(task.id, 'title', '未命名項目');
                    }
                    setEditingTaskId(null);
                  }}
                  className="flex-1 bg-[#8fb996] text-white text-xs font-bold py-2 rounded hover:bg-[#5b755e] transition-colors"
                >
                  確認張貼
                </button>
                <button 
                  onClick={() => {
                    if (!task.title.trim()) {
                      deleteTask(task.id);
                    }
                    setEditingTaskId(null);
                  }}
                  className="bg-[#fceded] text-[#c96262] text-xs font-bold px-3 py-2 rounded hover:bg-[#e6b1b1] transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="font-bold text-[15px] text-[#3e362e] mb-2 leading-tight pr-6">{task.title}</div>
              {task.desc && <div className="text-[13px] text-[#6b5e50] leading-relaxed mb-2">{task.desc}</div>}
              {(task.role || task.time) && (
                <div className="mt-auto pt-2 flex items-center justify-between border-t border-[#e8d5b5]">
                  {task.role && <div className="text-[11px] font-bold text-[#5b755e] bg-[#e8eedd] px-2 py-1 rounded-md border border-[#a5c2a8]">{task.role}</div>}
                  {task.time && <div className="text-xs font-bold text-[#8a7f72]">{task.time}</div>}
                </div>
              )}
            </>
          )}
        </div>
      );
    });
  };

  return (
    <main className="min-h-screen bg-[#f4f1ea] p-8 font-serif text-[#3e362e] bg-[url('https://www.transparenttextures.com/patterns/rice-paper-2.png')]">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        <Navigation />

        {/* Loading Overlay */}
        {loading && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"><div className="bg-white px-6 py-4 rounded-xl font-bold text-[#5b755e] shadow-xl text-lg flex items-center gap-3"><span>💾</span> <span>載入資料中...</span></div></div>}

        {/* 頂部：Sprint 資訊欄位 */}
        <section className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-xl overflow-hidden relative">
          <div className="bg-[#e07a5f] border-b-4 border-[#5b755e] p-4 text-xl font-bold text-white tracking-wider flex items-center gap-2 drop-shadow-sm">
            <span>🔥</span> Sprint 核心資訊
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="col-span-1 md:col-span-2 flex flex-col gap-2">
              <label className="font-bold text-[#6b5e50]">Sprint Goal (目標)</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#e07a5f]/50 shadow-inner font-medium text-[#3e362e]" 
                placeholder="輸入本期主要目標..." 
                value={data.sprintGoal}
                onChange={e => updateData({ sprintGoal: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2 relative">
              <label className="font-bold text-[#6b5e50]">週期 (天數)</label>
              <input 
                type="number" 
                min="1"
                max="30"
                value={sprintDays}
                onChange={handleDaysChange}
                className="w-full px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#e07a5f]/50 shadow-inner font-medium text-[#3e362e]" 
                placeholder="輸入天數 (最多 30)..." 
              />
              {errorMsg && (
                <div className="absolute -bottom-6 left-0 text-xs font-bold text-[#c96262] bg-[#fceded] px-2 py-0.5 rounded border border-[#e6b1b1] whitespace-nowrap">
                  {errorMsg}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-bold text-[#6b5e50]">利益關係人</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#e07a5f]/50 shadow-inner font-medium text-[#3e362e]" 
                placeholder="輸入相關業務單位或高管..." 
                value={data.stakeholders}
                onChange={e => updateData({ stakeholders: e.target.value })}
              />
            </div>
          </div>
        </section>

        {/* 看板區域 (Kanban Board) */}
        <section className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-xl overflow-hidden flex flex-col" style={{ minHeight: '650px' }}>
          <div className="bg-[#76a5af] border-b-4 border-[#5b755e] p-4 text-xl font-bold text-white flex justify-between items-center tracking-wider drop-shadow-sm">
            <div className="flex items-center gap-2">
              <span>🎏</span> <ScrumTooltip keyword="Sprint Backlog" text="任務看板 (Sprint Backlog)" />
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  const newId = `pbi-${Date.now()}`;
                  setTasks([{ id: newId, type: 'pbi', status: 'pbi', title: '', desc: '', role: '', time: '' }, ...tasks]);
                  setEditingTaskId(newId); // 新增後立刻進入編輯模式
                }}
                className="bg-[#fffdf9] text-[#8b5a2b] border-2 border-[#d4a373] px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-[#faebce] transition-all flex items-center gap-1"
              >
                <span>🍄</span> 新增 PBI
              </button>
              <button 
                onClick={() => {
                  const newId = `task-${Date.now()}`;
                  setTasks([{ id: newId, type: 'task', status: 'todo', title: '', desc: '', role: '', time: '' }, ...tasks]);
                  setEditingTaskId(newId); // 新增後立刻進入編輯模式
                }}
                className="bg-[#fffdf9] text-[#76a5af] border-2 border-[#5b755e] px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-[#e8eedd] hover:text-[#5b755e] transition-all flex items-center gap-1"
              >
                <span>🌱</span> 新增任務
              </button>
            </div>
          </div>
          
          
          <div className="flex-1 flex flex-col bg-[#f4f1ea]/50 overflow-x-auto relative">
             {/* Header Row (Combined) */}
             <div className="flex border-b-4 border-[#5b755e] min-w-[1050px]">
               <div className="w-64 md:w-72 flex-shrink-0 bg-[#e8e4d9] border-r-4 border-[#5b755e] p-3 font-bold text-center text-[#5b755e] tracking-wider sticky left-0 z-20 shadow-[4px_0_15px_-3px_rgba(0,0,0,0.1)]">
                 <ScrumTooltip keyword="Product Backlog" text="排序的 PBI (1-5)" />
               </div>
               <div className="flex-1 bg-[#fceded] border-r-4 border-[#5b755e] p-3 font-bold text-center text-[#c96262] tracking-wider min-w-[200px]">TO DO (待處理)</div>
               <div className="flex-1 bg-[#faebce] border-r-4 border-[#5b755e] p-3 font-bold text-center text-[#d4a373] tracking-wider min-w-[200px]">Doing (進行中)</div>
               <div className="flex-1 bg-[#e8eedd] border-r-4 border-[#5b755e] p-3 font-bold text-center text-[#4a7c59] tracking-wider min-w-[200px]">Done (已完成)</div>
               <div className="flex-1 bg-[#eac4d0] p-3 font-bold text-center text-[#9b596f] tracking-wider min-w-[200px]"><ScrumTooltip keyword="Increment" text="驗收的 PBI (增量)" /></div>
             </div>

             {/* Swimlanes */}
             <div className="flex-1 overflow-y-auto flex flex-col min-w-[1050px]">
               {tasks.filter(t => t.status === 'pbi').map((pbi) => {
                  return (
                  <div key={pbi.id} className="flex border-b-4 border-dashed border-[#b5a695]/30 min-h-[250px] group relative items-stretch">
                     {/* Background hint for swimlane */}
                     <div className="absolute inset-0 pointer-events-none border-l-8 border-[#d4a373]/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                     
                     {/* PBI Cell (Sticky Left) */}
                     <div className="w-64 md:w-72 flex-shrink-0 p-4 border-r-4 border-[#5b755e] bg-[#fffdf9] sticky left-0 z-10 shadow-[4px_0_15px_-3px_rgba(0,0,0,0.1)] flex flex-col" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'pbi', undefined, pbi.id)}>
                        {tasks.filter(t => t.id === pbi.id).map(task => {
                            const isEditing = editingTaskId === task.id;
                            return (
                                <div 
                                  key={task.id}
                                  draggable={!isEditing}
                                  onDragStart={(e) => onDragStart(e, task)}
                                  onDragOver={onDragOver}
                                  onDrop={(e) => {
                                    e.stopPropagation();
                                    onDrop(e, 'pbi', task.id, undefined);
                                  }}
                                  className={`bg-[#fffdf9] border-2 p-4 rounded-xl shadow-sm transition-all group/task relative flex-1
                                    ${task.type === 'pbi' ? 'border-[#d4a373] bg-[#f2e3c6] hover:bg-[#faebce]' : 'border-[#b5a695] hover:border-[#c96262]'}
                                    ${task.status === 'doing' ? 'border-l-8 border-l-[#d4a373]' : ''}
                                    ${!isEditing ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : 'shadow-md'}
                                  `}
                                >
                                  {/* Header */}
                                  <div className="flex justify-between items-start mb-3">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md border text-[#8b5a2b] bg-[#faebce] border-[#d4a373]`}>
                                      PBI
                                    </span>
                                    
                                    {!isEditing && (
                                      <div className="opacity-0 group-hover/task:opacity-100 transition-opacity flex gap-1 absolute top-2 right-2 bg-white/80 p-1 rounded-lg shadow-sm z-10">
                                        <button onClick={() => moveTask(task.id, -1)} className="text-gray-500 hover:text-gray-700 bg-gray-50 p-1.5 rounded-md text-xs font-bold" title="向上排序">🔼</button>
                                        <button onClick={() => moveTask(task.id, 1)} className="text-gray-500 hover:text-gray-700 bg-gray-50 p-1.5 rounded-md text-xs font-bold" title="向下排序">🔽</button>
                                        <button onClick={() => setEditingTaskId(task.id)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded-md" title="編輯">✏️</button>
                                        <button onClick={() => deleteTask(task.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-md" title="刪除">🗑️</button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Body */}
                                  {isEditing ? (
                                    <div className="space-y-2 mt-2">
                                      <input 
                                        type="text" 
                                        value={task.title} 
                                        onChange={(e) => updateTask(task.id, 'title', e.target.value)}
                                        className="w-full text-sm font-bold p-2 border-2 border-[#b5a695] rounded focus:outline-none focus:border-[#5b755e]"
                                        placeholder="PBI 標題"
                                      />
                                      <textarea 
                                        value={task.desc || ''} 
                                        onChange={(e) => updateTask(task.id, 'desc', e.target.value)}
                                        className="w-full text-xs p-2 border-2 border-[#b5a695] rounded focus:outline-none focus:border-[#5b755e]"
                                        placeholder="PBI 描述說明 (選填)"
                                        rows={3}
                                      />
                                      <div className="flex justify-end gap-2 mt-2">
                                        <button onClick={() => setEditingTaskId(null)} className="text-xs font-bold bg-[#5b755e] text-white px-3 py-1 rounded hover:bg-[#4a614d] transition-colors">完成</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <h4 className="text-sm font-bold text-[#3e362e] mb-1">{task.title || '(未命名項目)'}</h4>
                                      {task.desc && <p className="text-xs text-[#6b5e50] line-clamp-3 mb-2 whitespace-pre-wrap">{task.desc}</p>}
                                    </>
                                  )}
                                </div>
                            );
                        })}
                     </div>

                     <div className="flex-1 p-2 border-r-4 border-[#5b755e] bg-[#fceded]/10 flex flex-col min-w-[200px]" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'todo', undefined, pbi.id)}>
                       <div className="flex justify-end gap-1 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                             onClick={() => handleAiGenerateTasks(pbi.id, pbi.title)}
                             disabled={isAiLoading}
                             className="text-xs font-bold bg-white border border-[#a28bd4] text-[#a28bd4] px-2 py-1 rounded hover:bg-[#a28bd4] hover:text-white transition-colors shadow-sm disabled:opacity-50"
                          >
                             🤖 AI 拆解
                          </button>
                          <button onClick={() => {
                             const newId = `task-${Date.now()}`;
                             setTasks((prev) => [{ id: newId, type: 'task', status: 'todo', title: '', desc: '', role: '', time: '', pbiId: pbi.id }, ...prev]);
                             setEditingTaskId(newId);
                          }} className="text-xs font-bold bg-white border border-[#e6b1b1] text-[#c96262] px-2 py-1 rounded hover:bg-[#c96262] hover:text-white transition-colors shadow-sm">➕ 建立任務</button>
                       </div>
                       <div className="flex flex-col gap-2 flex-1">
                         {renderTasks('todo', pbi.id)}
                       </div>
                     </div>
                     
                     <div className="flex-1 p-2 border-r-4 border-[#5b755e] bg-[#faebce]/10 min-w-[200px]" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'doing', undefined, pbi.id)}>
                       <div className="flex flex-col gap-2 h-full">
                         {renderTasks('doing', pbi.id)}
                       </div>
                     </div>
                     
                     <div className="flex-1 p-2 border-r-4 border-[#5b755e] bg-[#e8eedd]/10 min-w-[200px]" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'done', undefined, pbi.id)}>
                       <div className="flex flex-col gap-2 h-full">
                         {renderTasks('done', pbi.id)}
                       </div>
                     </div>
                     
                     <div className="flex-1 p-2 bg-[#eac4d0]/10 flex items-center justify-center min-w-[200px]">
                       <div className="text-[#9b596f]/30 font-bold text-sm transform -rotate-12">對應 PBI 增量</div>
                     </div>
                  </div>
                  );
               })}
               
               {/* Unassigned Tasks Row (如果有的話) */}
               <div className="flex min-h-[250px] bg-white/30 items-stretch">
                     {/* PBI Cell (Empty for Unassigned) */}
                     <div className="w-64 md:w-72 flex-shrink-0 p-4 border-r-4 border-[#5b755e] bg-[#fffdf9] sticky left-0 z-10 shadow-[4px_0_15px_-3px_rgba(0,0,0,0.1)] flex flex-col">
                         <div className="flex items-center justify-center h-full text-[#b5a695]/50 text-xs font-bold border-2 border-dashed border-[#b5a695]/30 rounded-xl m-2 flex-1">
                             <span>無歸屬任務區</span>
                         </div>
                     </div>

                     <div className="flex-1 p-2 border-r-4 border-[#5b755e] bg-[#fceded]/30 min-w-[200px]" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'todo', undefined, 'unassigned')}>
                       <div className="text-xs font-bold text-[#c96262]/50 mb-2 px-2">無歸屬任務區</div>
                       <div className="flex flex-col gap-2 h-full">
                         {renderTasks('todo', 'unassigned')}
                       </div>
                     </div>
                     
                     <div className="flex-1 p-2 border-r-4 border-[#5b755e] bg-[#faebce]/30 min-w-[200px]" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'doing', undefined, 'unassigned')}>
                       <div className="text-xs font-bold text-[#d4a373]/50 mb-2 px-2">無歸屬任務區</div>
                       <div className="flex flex-col gap-2 h-full">
                         {renderTasks('doing', 'unassigned')}
                       </div>
                     </div>
                     
                     <div className="flex-1 p-2 border-r-4 border-[#5b755e] bg-[#e8eedd]/30 min-w-[200px]" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'done', undefined, 'unassigned')}>
                       <div className="text-xs font-bold text-[#4a7c59]/50 mb-2 px-2">無歸屬任務區</div>
                       <div className="flex flex-col gap-2 h-full">
                         {renderTasks('done', 'unassigned')}
                       </div>
                     </div>
                     
                     <div className="flex-1 p-2 bg-[#eac4d0]/30 flex items-center justify-center min-w-[200px]">
                     </div>
               </div>
             </div>
          </div>
        </section>
        
      </div>
    </main>
  );
}
