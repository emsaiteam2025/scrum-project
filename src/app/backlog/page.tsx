"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useAutoSave } from '@/hooks/useAutoSave';
import Navigation from '@/components/Navigation';
import ScrumTooltip from '@/components/ScrumTooltip';
import SaveIndicator from '@/components/SaveIndicator';

interface Task {
  id: string;
  type: 'pbi' | 'task';
  status: 'pbi' | 'todo' | 'doing' | 'done' | 'accepted';
  title: string;
  desc?: string;
  role?: string;
  time?: string;
  pbiId?: string;
  acceptedBy?: string;
  acceptedAt?: string;
}

const initialTasks: Task[] = [];

export default function Backlog() {
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isPhotoRestoring, setIsPhotoRestoring] = useState(false);
  const [poName, setPoName] = useState<string>('');
  const [mobileStatusFilter, setMobileStatusFilter] = useState<'all' | 'todo' | 'doing' | 'done'>('all');
  const photoRestoredAt = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deletedPbiIds = useRef<Set<string>>(new Set());

  const { data, updateData, syncData, loading, forceSave, saveStatus } = useAutoSave('backlog', {
    sprintDays: 30 as number | string,
    tasks: initialTasks,
    sprintGoal: '',
    stakeholders: '',
    devsList: [] as string[]
  });

  const sprintDays = data.sprintDays;
  const tasks = data.tasks;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setTasks = (valOrFn: Task[] | ((prev: Task[]) => Task[])) => {
    updateData((prevData: {tasks: Task[]}) => ({
      tasks: typeof valOrFn === 'function' ? valOrFn(prevData.tasks) : valOrFn
    }));
  };

  // 背景同步用：不觸發 isDirty，避免 Planning sync 每 5 秒寫入 Firebase
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setSyncTasks = (valOrFn: Task[] | ((prev: Task[]) => Task[])) => {
    syncData((prevData: {tasks: Task[]}) => ({
      tasks: typeof valOrFn === 'function' ? valOrFn(prevData.tasks) : valOrFn
    }));
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
        // 照片還原後 15 秒內跳過同步，避免覆蓋剛還原的資料
        if (Date.now() - photoRestoredAt.current < 15000) return;
        const sprintId = localStorage.getItem('currentSprintId');
        if (!sprintId) return;

        const { getAuth } = await import('firebase/auth');
        const { doc, getDoc } = await import('firebase/firestore');
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

        if (planningData) {
          if (planningData.devs) {
            const devsArray = planningData.devs.split(/[,、，\n]/).map((d: string) => d.trim()).filter((d: string) => d);
            // 避免 Viewer 觸發 syncData 導致報錯
            if (!isPublicViewer || auth.currentUser) {
               syncData({ devsList: devsArray });
            }
          }

          if (planningData.whats) {
          const whats = planningData.whats.filter((w: {id: string, text: string}) => w.text && w.text.trim() !== '');

          if (!isPublicViewer || auth.currentUser) {
          setSyncTasks(prev => {
            let newPbis = prev.filter(t => t.type === 'pbi');
            const tasksList = prev.filter(t => t.type === 'task');
            
            // 1. 同步 Planning 新增或修改的 WHAT (只針對 PBI)
            whats.forEach((w: {id: string, text: string}) => {
              const existingIndex = newPbis.findIndex(t => t.id === w.id);
              if (existingIndex >= 0) {
                if (newPbis[existingIndex].title !== w.text) {
                  newPbis[existingIndex] = { ...newPbis[existingIndex], title: w.text };
                }
              } else {
                // 跳過使用者在 Backlog 手動刪除過的 PBI，不重新加入
                if (!deletedPbiIds.current.has(w.id)) {
                  newPbis.push({
                    id: w.id,
                    type: 'pbi',
                    status: 'pbi',
                    title: w.text
                  });
                }
              }
            });

            // 2. 只移除「由 Planning 同步進來、且已被 Planning 刪除」的 PBI
            // 照片還原的 PBI (photo-pbi-*) 和手動新增的 PBI (pbi-*) 永遠保留
            const whatIds = whats.map((w: {id: string, text: string}) => w.id);
            const planningIds = new Set(whatIds);
            newPbis = newPbis.filter(t =>
              planningIds.has(t.id) ||       // 仍在 Planning 清單中
              t.id.startsWith('photo-') ||   // 照片還原的 PBI
              t.id.startsWith('pbi-')        // 手動新增的 PBI
            );

            // 將同步好的 PBI 與原本的 Tasks 合併
            const mergedTasks = [...newPbis, ...tasksList];
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hashTask = (t: any) => `${t.id}|${t.title}|${t.desc}|${t.status}|${t.role}|${t.time}|${t.pbiId}`;
            const prevHash = prev.map(hashTask).sort().join(',');
            const mergedHash = mergedTasks.map(hashTask).sort().join(',');
            
            if (prevHash !== mergedHash) {
               return mergedTasks;
            }
            
            return prev;
          });
          } // end of !isPublicViewer
        } // end of if (planningData.whats)
        } // end of if (planningData)
      } catch (err) {
        console.error("Sync PBI failed:", err);
      }
    };
    
    syncWhatsFromPlanning();
    
    // 設定每 5 秒同步一次以達成類似即時的效果
    const interval = setInterval(syncWhatsFromPlanning, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);


  useEffect(() => {
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  // 從 localStorage 載入已刪除的 PBI ID，避免 Planning 同步重新加回
  useEffect(() => {
    const sprintId = localStorage.getItem('currentSprintId');
    if (!sprintId) return;
    try {
      const stored = localStorage.getItem(`deleted_pbis_${sprintId}`);
      if (stored) deletedPbiIds.current = new Set(JSON.parse(stored));
    } catch {}
  }, []);

  // 從 Firebase 讀取 Planning 的 PO 名字作為驗收官
  useEffect(() => {
    const sprintId = localStorage.getItem('currentSprintId');
    if (!sprintId) return;
    const loadPo = async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const snap = await getDoc(doc(db, 'sprints', sprintId));
        if (snap.exists() && snap.data().planning?.po) {
          setPoName(snap.data().planning.po);
        }
      } catch {}
    };
    loadPo();
  }, []);

  const acceptPbi = (id: string) => {
    const now = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, acceptedBy: poName || 'PO', acceptedAt: now } : t
    ));
  };

  const handleAiGenerateTasks = async (pbiId: string, pbiTitle: string) => {
    if (!apiKey) {
      alert('⚠️ 請先於頁面設定 API Key (OpenAI 或 Gemini 均可)，才能啟動 AI 拆解任務功能！');
      return;
    }
    setIsAiLoading(true);
    try {
      const response = await fetch('/api/ai-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pbiTitle, apiKey })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || '後端請求失敗');
      }

      const data = await response.json();
      let aiContent = data.result || '';
      aiContent = aiContent.trim();
      
      const startIdx = aiContent.indexOf('[');
      const endIdx = aiContent.lastIndexOf(']');
      if (startIdx !== -1 && endIdx !== -1) {
        aiContent = aiContent.substring(startIdx, endIdx + 1);
      }
      
      let parsedTasks = [];
      try {
        parsedTasks = JSON.parse(aiContent);
      } catch {
        console.error("JSON 解析失敗，原始字串為:", aiContent);
        throw new Error("AI 回傳的格式不正確，無法解析為 JSON");
      }
      
      setTasks((prev) => {
        const newTasks = parsedTasks.map((t: {title: string, desc: string}, i: number) => ({
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
      
    } catch (error: unknown) {
      const err = error as Error;
      console.error('AI Generate Error:', err);
      alert('產生失敗：' + (err.message || '未知錯誤') + '\n請確認 API Key 是否有效，或查看 Console 了解詳細錯誤。');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handlePhotoRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!apiKey) {
      alert('⚠️ 請先輸入 Gemini API Key（以 AIza 開頭），才能使用照片還原功能！');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsPhotoRestoring(true);
    try {
      // 壓縮圖片到 1500x3000px 以內，避免超過 Vercel 4.5MB 請求限制
      const { base64: imageBase64, mimeType: compressedMimeType } = await new Promise<{ base64: string; mimeType: string }>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const MAX_WIDTH = 1500;
          const MAX_HEIGHT = 3000;
          const ratio = Math.min(1, MAX_WIDTH / img.width, MAX_HEIGHT / img.height);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
        };
        img.onerror = reject;
        img.src = url;
      });

      const response = await fetch('/api/ai-restore-backlog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: compressedMimeType, apiKey })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `照片解析失敗（HTTP ${response.status}）`);
      }

      const resData = await response.json();
      const restoredTasks = resData.tasks;

      if (!Array.isArray(restoredTasks)) {
        throw new Error('AI 回傳格式錯誤，請重試');
      }

      setTasks(restoredTasks);
      photoRestoredAt.current = Date.now();
      // 照片還原是全新取代，清除已刪除 PBI 記錄
      deletedPbiIds.current = new Set();
      const sid = localStorage.getItem('currentSprintId');
      if (sid) localStorage.removeItem(`deleted_pbis_${sid}`);

      setTimeout(() => forceSave && forceSave(), 100);

      alert(`✅ 成功從照片還原 ${restoredTasks.length} 個項目！`);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Photo restore error:', error);
      alert('照片還原失敗：' + (error.message || '未知錯誤'));
    } finally {
      setIsPhotoRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
    // 若刪除的是 PBI，記錄其 ID 防止 Planning 同步重新加入
    const target = data.tasks.find(t => t.id === id);
    if (target?.type === 'pbi') {
      deletedPbiIds.current.add(id);
      const sprintId = localStorage.getItem('currentSprintId');
      if (sprintId) {
        try {
          localStorage.setItem(`deleted_pbis_${sprintId}`, JSON.stringify(Array.from(deletedPbiIds.current)));
        } catch {}
      }
    }
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

  const copyTask = (id: string) => {
    setTasks((prev: Task[]) => {
      const index = prev.findIndex(t => t.id === id);
      if (index === -1) return prev;
      const original = prev[index];
      const copied: Task = { ...original, id: `${original.type}-${Date.now()}` };
      const newTasks = [...prev];
      newTasks.splice(index + 1, 0, copied);
      return newTasks;
    });
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
                <button onClick={() => copyTask(task.id)} className="text-emerald-500 hover:text-emerald-700 bg-emerald-50 p-1.5 rounded-md" title="複製">📋</button>
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
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={task.role || ''} 
                      onChange={(e) => updateTask(task.id, 'role', e.target.value)}
                      className="w-1/2 text-xs p-2 border-2 border-[#b5a695] rounded focus:outline-none focus:border-[#5b755e]"
                      placeholder="負責人 (可多選)"
                    />
                    <input 
                      type="text" 
                      value={task.time || ''} 
                      onChange={(e) => updateTask(task.id, 'time', e.target.value)}
                      className="w-1/2 text-xs p-2 border-2 border-[#b5a695] rounded focus:outline-none focus:border-[#5b755e]"
                      placeholder="預估工時 (例: 4h)"
                    />
                  </div>
                  {data.devsList && data.devsList.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {data.devsList.map((dev: string) => {
                        const currentRoles = (task.role || '').split(',').map((r: string) => r.trim()).filter((r: string) => r);
                        const isSelected = currentRoles.includes(dev);
                        return (
                          <button
                            key={dev}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                updateTask(task.id, 'role', currentRoles.filter((r: string) => r !== dev).join(', '));
                              } else {
                                updateTask(task.id, 'role', [...currentRoles, dev].join(', '));
                              }
                            }}
                            className={`text-[10px] font-bold px-2 py-1 rounded-md border transition-colors ${
                              isSelected 
                                ? 'bg-[#5b755e] text-white border-[#5b755e]' 
                                : 'bg-[#e8eedd] text-[#5b755e] border-[#a5c2a8] hover:bg-[#d5dfca]'
                            }`}
                          >
                            {dev} {isSelected ? '✓' : '+'}
                          </button>
                        );
                      })}
                    </div>
                  )}
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
                    setTimeout(() => forceSave && forceSave(), 50); // 確保狀態更新後立即觸發存檔
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
              <div className="font-bold text-[15px] text-[#3e362e] mb-2 leading-tight pr-6 break-all">{task.title}</div>
              {task.desc && <div className="text-[13px] text-[#6b5e50] leading-relaxed mb-2 break-words whitespace-pre-wrap">{task.desc}</div>}
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
    <main className="min-h-screen bg-[#f4f1ea] p-4 md:p-8 font-serif text-[#3e362e] bg-[url('https://www.transparenttextures.com/patterns/rice-paper-2.png')]">
      <div className="max-w-[1400px] mx-auto space-y-8">

        <div className="flex flex-col items-center">
          <Navigation />
          <SaveIndicator status={saveStatus} />
          <div className="text-sm text-[#8a7f72] font-medium mt-1">
            {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
        </div>

        {/* Loading Overlay */}
        {loading && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"><div className="bg-white px-6 py-4 rounded-xl font-bold text-[#5b755e] shadow-xl text-lg flex items-center gap-3"><span>💾</span> <span>載入資料中...</span></div></div>}

        {/* 頂部：Sprint 資訊欄位 */}
        <section className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-xl overflow-hidden relative">
          <div className="bg-[#e07a5f] border-b-4 border-[#5b755e] p-4 text-xl font-bold text-white tracking-wider flex items-center gap-2 drop-shadow-sm">
            <span>🔥</span> Sprint 核心資訊
          </div>
          <div className="p-6 flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-1 flex flex-col gap-2">
              <label className="font-bold text-lg text-[#e07a5f]">🎯 Sprint Goal（目標）</label>
              <input
                type="text"
                className="w-full px-5 py-4 bg-[#fff8f0] border-2 border-[#e07a5f] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#e07a5f]/40 shadow-inner font-bold text-[#3e362e] text-base placeholder:font-normal placeholder:text-[#c0a898]"
                placeholder="輸入本期主要目標..."
                value={data.sprintGoal}
                onChange={e => updateData({ sprintGoal: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2 relative md:w-40">
              <label className="font-bold text-lg text-[#6b5e50]">週期（天）</label>
              <input
                type="number"
                min="1"
                max="30"
                value={sprintDays}
                onChange={handleDaysChange}
                className="w-full px-4 py-4 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#e07a5f]/50 shadow-inner font-medium text-[#3e362e]"
                placeholder="最多 30"
              />
              {errorMsg && (
                <div className="absolute -bottom-6 left-0 text-xs font-bold text-[#c96262] bg-[#fceded] px-2 py-0.5 rounded border border-[#e6b1b1] whitespace-nowrap">
                  {errorMsg}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 完成進度 */}
        {(() => {
          const allTasks = tasks.filter(t => t.type === 'task');
          const pbis = tasks.filter(t => t.status === 'pbi');
          if (allTasks.length === 0 && pbis.length === 0) return null;
          const todo = allTasks.filter(t => t.status === 'todo').length;
          const doing = allTasks.filter(t => t.status === 'doing').length;
          const done = allTasks.filter(t => t.status === 'done').length;
          const total = allTasks.length;
          const pct = (n: number) => total > 0 ? Math.round(n / total * 100) : 0;
          return (
            <section className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-xl overflow-hidden">
              <div className="bg-[#8fb996] border-b-4 border-[#5b755e] p-4 text-xl font-bold text-white tracking-wider flex items-center gap-2 drop-shadow-sm">
                <span>📊</span> 任務完成進度
              </div>
              <div className="p-4 md:p-6 space-y-6">

                {/* 整體進度 */}
                {total > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-end justify-between">
                      <div className="font-bold text-[#5b755e] text-base md:text-lg">整體完成率</div>
                      <div className="text-3xl font-bold text-[#4a7c59]">{pct(done)}%</div>
                    </div>
                    {/* 堆疊式進度條 */}
                    <div className="w-full h-6 rounded-full bg-[#e8e4d9] overflow-hidden flex border-2 border-[#b5a695]">
                      {done > 0 && <div style={{ width: `${pct(done)}%` }} className="bg-[#8fb996] h-full transition-all duration-500" />}
                      {doing > 0 && <div style={{ width: `${pct(doing)}%` }} className="bg-[#d4a373] h-full transition-all duration-500" />}
                      {todo > 0 && <div style={{ width: `${pct(todo)}%` }} className="bg-[#e6b1b1] h-full transition-all duration-500" />}
                    </div>
                    {/* 圖例 */}
                    <div className="flex gap-3 text-xs font-bold text-[#8a7f72]">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#8fb996] inline-block" />完成</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#d4a373] inline-block" />進行中</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#e6b1b1] inline-block" />待處理</span>
                    </div>
                    {/* 數字卡片 */}
                    <div className="grid grid-cols-3 gap-2 md:gap-3">
                      <div className="bg-[#e8eedd] border-2 border-[#a5c2a8] rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-[#4a7c59]">{done}</div>
                        <div className="text-xs font-bold text-[#5b755e] mt-1">✅ 完成</div>
                        <div className="text-[10px] text-[#8a7f72]">{pct(done)}%</div>
                      </div>
                      <div className="bg-[#faebce] border-2 border-[#e6c98a] rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-[#d4a373]">{doing}</div>
                        <div className="text-xs font-bold text-[#d4a373] mt-1">⚡ 進行中</div>
                        <div className="text-[10px] text-[#8a7f72]">{pct(doing)}%</div>
                      </div>
                      <div className="bg-[#fceded] border-2 border-[#e6b1b1] rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-[#c96262]">{todo}</div>
                        <div className="text-xs font-bold text-[#c96262] mt-1">📋 待處理</div>
                        <div className="text-[10px] text-[#8a7f72]">{pct(todo)}%</div>
                      </div>
                    </div>
                    <div className="text-xs text-[#8a7f72] text-right font-bold">共 {total} 個任務</div>
                  </div>
                )}

                {/* PBI 逐項進度表 */}
                {pbis.length > 0 && (
                  <div className="space-y-2">
                    <div className="font-bold text-[#6b5e50] border-b-2 border-[#e8d5b5] pb-2">PBI 逐項進度</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[380px]">
                        <thead>
                          <tr className="border-b-2 border-[#e8d5b5] bg-[#faf8f5]">
                            <th className="text-left py-2 px-3 text-[#6b5e50] font-bold">PBI 項目</th>
                            <th className="text-center py-2 px-2 text-[#c96262] font-bold w-14">待</th>
                            <th className="text-center py-2 px-2 text-[#d4a373] font-bold w-14">行</th>
                            <th className="text-center py-2 px-2 text-[#4a7c59] font-bold w-14">完</th>
                            <th className="py-2 px-3 text-[#6b5e50] font-bold">進度</th>
                            <th className="text-center py-2 px-2 text-[#9b596f] font-bold w-12">驗收</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pbis.map(pbi => {
                            const pt = allTasks.filter(t => t.pbiId === pbi.id);
                            const pt_todo = pt.filter(t => t.status === 'todo').length;
                            const pt_doing = pt.filter(t => t.status === 'doing').length;
                            const pt_done = pt.filter(t => t.status === 'done').length;
                            const pt_total = pt.length;
                            const pt_pct = pt_total > 0 ? Math.round(pt_done / pt_total * 100) : 0;
                            const pt_doing_pct = pt_total > 0 ? Math.round(pt_doing / pt_total * 100) : 0;
                            return (
                              <tr key={pbi.id} className="border-b border-[#f0ebe4] hover:bg-[#faf8f5] transition-colors">
                                <td className="py-3 px-3 max-w-[140px] md:max-w-[220px]">
                                  <div className="font-bold text-[#3e362e] text-xs leading-tight truncate" title={pbi.title}>{pbi.title || '(未命名)'}</div>
                                </td>
                                <td className="text-center py-3 px-2">
                                  <span className={`text-sm font-bold ${pt_todo > 0 ? 'text-[#c96262]' : 'text-[#d3cbbd]'}`}>{pt_todo}</span>
                                </td>
                                <td className="text-center py-3 px-2">
                                  <span className={`text-sm font-bold ${pt_doing > 0 ? 'text-[#d4a373]' : 'text-[#d3cbbd]'}`}>{pt_doing}</span>
                                </td>
                                <td className="text-center py-3 px-2">
                                  <span className={`text-sm font-bold ${pt_done > 0 ? 'text-[#4a7c59]' : 'text-[#d3cbbd]'}`}>{pt_done}</span>
                                </td>
                                <td className="py-3 px-3">
                                  {pt_total > 0 ? (
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-2.5 rounded-full bg-[#e8e4d9] overflow-hidden flex border border-[#d3cbbd]">
                                        {pt_done > 0 && <div style={{ width: `${pt_pct}%` }} className="bg-[#8fb996] h-full" />}
                                        {pt_doing > 0 && <div style={{ width: `${pt_doing_pct}%` }} className="bg-[#d4a373] h-full" />}
                                      </div>
                                      <span className="text-xs font-bold text-[#5b755e] w-8 text-right shrink-0">{pt_pct}%</span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-[#d3cbbd]">尚無任務</span>
                                  )}
                                </td>
                                <td className="text-center py-3 px-2">
                                  {pbi.acceptedBy ? <span title={`${pbi.acceptedBy} ${pbi.acceptedAt}`}>✅</span> : <span className="text-[#d3cbbd]">○</span>}
                                </td>
                              </tr>
                            );
                          })}
                          {/* 無歸屬任務列 */}
                          {(() => {
                            const ut = allTasks.filter(t => !t.pbiId);
                            if (ut.length === 0) return null;
                            const ut_todo = ut.filter(t => t.status === 'todo').length;
                            const ut_doing = ut.filter(t => t.status === 'doing').length;
                            const ut_done = ut.filter(t => t.status === 'done').length;
                            const ut_total = ut.length;
                            const ut_pct = ut_total > 0 ? Math.round(ut_done / ut_total * 100) : 0;
                            const ut_doing_pct = ut_total > 0 ? Math.round(ut_doing / ut_total * 100) : 0;
                            return (
                              <tr className="border-b border-[#f0ebe4] bg-[#f9f7f4]">
                                <td className="py-3 px-3">
                                  <div className="font-bold text-[#8a7f72] text-xs italic">無歸屬任務</div>
                                </td>
                                <td className="text-center py-3 px-2"><span className={`text-sm font-bold ${ut_todo > 0 ? 'text-[#c96262]' : 'text-[#d3cbbd]'}`}>{ut_todo}</span></td>
                                <td className="text-center py-3 px-2"><span className={`text-sm font-bold ${ut_doing > 0 ? 'text-[#d4a373]' : 'text-[#d3cbbd]'}`}>{ut_doing}</span></td>
                                <td className="text-center py-3 px-2"><span className={`text-sm font-bold ${ut_done > 0 ? 'text-[#4a7c59]' : 'text-[#d3cbbd]'}`}>{ut_done}</span></td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2.5 rounded-full bg-[#e8e4d9] overflow-hidden flex border border-[#d3cbbd]">
                                      {ut_done > 0 && <div style={{ width: `${ut_pct}%` }} className="bg-[#8fb996] h-full" />}
                                      {ut_doing > 0 && <div style={{ width: `${ut_doing_pct}%` }} className="bg-[#d4a373] h-full" />}
                                    </div>
                                    <span className="text-xs font-bold text-[#5b755e] w-8 text-right shrink-0">{ut_pct}%</span>
                                  </div>
                                </td>
                                <td className="text-center py-3 px-2"><span className="text-[#d3cbbd]">—</span></td>
                              </tr>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })()}

        {/* 手機版任務看板 */}
        <section className="md:hidden bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-[#76a5af] border-b-4 border-[#5b755e] p-4">
            <div className="flex items-center gap-2 text-white font-bold text-lg mb-3"><span>🎏</span> 任務看板</div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => fileInputRef.current?.click()} disabled={isPhotoRestoring} className="bg-[#fffdf9] text-[#467386] border-2 border-[#76a5af] px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1 disabled:opacity-50">
                {isPhotoRestoring ? '🔍 解析中...' : '📸 從照片還原'}
              </button>
              <button onClick={() => { const newId = `pbi-${Date.now()}`; setTasks([{ id: newId, type: 'pbi', status: 'pbi', title: '', desc: '', role: '', time: '' }, ...tasks]); setEditingTaskId(newId); }} className="bg-[#fffdf9] text-[#8b5a2b] border-2 border-[#d4a373] px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1">🍄 新增 PBI</button>
              <button onClick={() => { const newId = `task-${Date.now()}`; setTasks([{ id: newId, type: 'task', status: 'todo', title: '', desc: '', role: '', time: '' }, ...tasks]); setEditingTaskId(newId); }} className="bg-[#fffdf9] text-[#76a5af] border-2 border-[#5b755e] px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1">🌱 新增任務</button>
            </div>
          </div>

          {/* 狀態篩選 Tabs */}
          <div className="flex border-b-2 border-[#b5a695] bg-[#f4f1ea] sticky top-0 z-10">
            {([
              { key: 'all', label: '全部', active: 'text-[#5b755e] border-[#5b755e] bg-white' },
              { key: 'todo', label: 'TO DO', active: 'text-[#c96262] border-[#c96262] bg-white' },
              { key: 'doing', label: '進行中', active: 'text-[#d4a373] border-[#d4a373] bg-white' },
              { key: 'done', label: '完成', active: 'text-[#4a7c59] border-[#4a7c59] bg-white' },
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => setMobileStatusFilter(tab.key)} className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-colors ${mobileStatusFilter === tab.key ? tab.active : 'text-[#8a7f72] border-transparent'}`}>{tab.label}</button>
            ))}
          </div>

          <div className="p-3 space-y-4">
            {tasks.filter(t => t.status === 'pbi').map(pbi => {
              const pbiTasks = tasks.filter(t => t.type === 'task' && t.pbiId === pbi.id);
              const filtered = mobileStatusFilter === 'all' ? pbiTasks : pbiTasks.filter(t => t.status === mobileStatusFilter);
              if (mobileStatusFilter !== 'all' && filtered.length === 0) return null;
              const isEditingPbi = editingTaskId === pbi.id;
              return (
                <div key={pbi.id} className="border-2 border-[#d4a373] rounded-2xl overflow-hidden">
                  {/* PBI 標頭 */}
                  <div className="bg-[#f2e3c6] p-3">
                    {isEditingPbi ? (
                      <div className="space-y-2">
                        <input type="text" value={pbi.title} onChange={e => updateTask(pbi.id, 'title', e.target.value)} className="w-full text-sm font-bold p-2 border-2 border-[#b5a695] rounded" placeholder="PBI 標題" />
                        <textarea value={pbi.desc || ''} onChange={e => updateTask(pbi.id, 'desc', e.target.value)} className="w-full text-xs p-2 border-2 border-[#b5a695] rounded" rows={2} placeholder="PBI 描述說明 (選填)" />
                        <button onClick={() => { setEditingTaskId(null); setTimeout(() => forceSave && forceSave(), 50); }} className="w-full bg-[#5b755e] text-white text-xs font-bold py-2 rounded">完成</button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded border text-[#8b5a2b] bg-[#faebce] border-[#d4a373]">PBI</span>
                          <div className="font-bold text-sm text-[#3e362e] mt-1 break-words">{pbi.title || '(未命名)'}</div>
                          {pbi.desc && <div className="text-xs text-[#6b5e50] mt-0.5 break-words">{pbi.desc}</div>}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => handleAiGenerateTasks(pbi.id, pbi.title)} disabled={isAiLoading} className="text-[#a28bd4] bg-white border border-[#a28bd4] p-1.5 rounded-md text-xs disabled:opacity-50" title="AI拆解">🤖</button>
                          <button onClick={() => copyTask(pbi.id)} className="text-emerald-500 bg-emerald-50 p-1.5 rounded-md text-sm" title="複製">📋</button>
                          <button onClick={() => setEditingTaskId(pbi.id)} className="text-blue-500 bg-blue-50 p-1.5 rounded-md text-sm" title="編輯">✏️</button>
                          <button onClick={() => deleteTask(pbi.id)} className="text-red-500 bg-red-50 p-1.5 rounded-md text-sm" title="刪除">🗑️</button>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* 任務清單 */}
                  <div className="p-2 space-y-2 bg-white">
                    <button onClick={() => { const newId = `task-${Date.now()}`; setTasks(prev => [{ id: newId, type: 'task', status: 'todo', title: '', desc: '', role: '', time: '', pbiId: pbi.id }, ...prev]); setEditingTaskId(newId); }} className="w-full text-xs font-bold bg-[#fceded] text-[#c96262] border border-[#e6b1b1] px-3 py-1.5 rounded-lg flex items-center justify-center gap-1">➕ 建立任務</button>
                    {filtered.length === 0 ? (
                      <div className="text-center text-xs text-[#b5a695] py-2">此 PBI 尚無任務</div>
                    ) : filtered.map(task => {
                      const isEditing = editingTaskId === task.id;
                      const sC: Record<string,string> = { todo:'bg-[#fceded] text-[#c96262] border-[#e6b1b1]', doing:'bg-[#faebce] text-[#d4a373] border-[#e6c98a]', done:'bg-[#e8eedd] text-[#4a7c59] border-[#a5c2a8]' };
                      const sL: Record<string,string> = { todo:'TO DO', doing:'進行中', done:'完成' };
                      return (
                        <div key={task.id} className="border-2 border-[#b5a695] rounded-xl p-3 bg-[#fffdf9]">
                          {isEditing ? (
                            <div className="space-y-2">
                              <input type="text" value={task.title} onChange={e => updateTask(task.id,'title',e.target.value)} className="w-full text-sm font-bold p-2 border-2 border-[#b5a695] rounded" placeholder="任務標題" />
                              <textarea value={task.desc||''} onChange={e => updateTask(task.id,'desc',e.target.value)} className="w-full text-xs p-2 border-2 border-[#b5a695] rounded" rows={2} placeholder="任務說明 (選填)" />
                              <div className="flex gap-2">
                                <input type="text" value={task.role||''} onChange={e => updateTask(task.id,'role',e.target.value)} className="flex-1 text-xs p-2 border-2 border-[#b5a695] rounded" placeholder="負責人" />
                                <input type="text" value={task.time||''} onChange={e => updateTask(task.id,'time',e.target.value)} className="flex-1 text-xs p-2 border-2 border-[#b5a695] rounded" placeholder="工時" />
                              </div>
                              {data.devsList && data.devsList.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {data.devsList.map((dev:string) => {
                                    const cur=(task.role||'').split(',').map((r:string)=>r.trim()).filter((r:string)=>r);
                                    const sel=cur.includes(dev);
                                    return <button key={dev} type="button" onClick={()=>updateTask(task.id,'role',sel?cur.filter((r:string)=>r!==dev).join(', '):[...cur,dev].join(', '))} className={`text-[10px] font-bold px-2 py-1 rounded-md border ${sel?'bg-[#5b755e] text-white border-[#5b755e]':'bg-[#e8eedd] text-[#5b755e] border-[#a5c2a8]'}`}>{dev} {sel?'✓':'+'}</button>;
                                  })}
                                </div>
                              )}
                              <select value={task.status} onChange={e => updateTask(task.id,'status',e.target.value)} className="w-full text-xs p-2 border-2 border-[#b5a695] rounded bg-white text-[#6b5e50]">
                                <option value="todo">TO DO（待處理）</option>
                                <option value="doing">進行中</option>
                                <option value="done">已完成</option>
                              </select>
                              <div className="flex gap-2">
                                <button onClick={()=>{if(!task.title.trim())updateTask(task.id,'title','未命名項目');setEditingTaskId(null);setTimeout(()=>forceSave&&forceSave(),50);}} className="flex-1 bg-[#8fb996] text-white text-xs font-bold py-2 rounded">確認張貼</button>
                                <button onClick={()=>{if(!task.title.trim())deleteTask(task.id);setEditingTaskId(null);}} className="bg-[#fceded] text-[#c96262] text-xs font-bold px-3 py-2 rounded">取消</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm text-[#3e362e] break-words">{task.title}</div>
                                {task.desc && <div className="text-xs text-[#6b5e50] mt-0.5 break-words whitespace-pre-wrap">{task.desc}</div>}
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${sC[task.status]}`}>{sL[task.status]}</span>
                                  {task.role && <span className="text-[10px] font-bold text-[#5b755e] bg-[#e8eedd] px-1.5 py-0.5 rounded">{task.role}</span>}
                                  {task.time && <span className="text-[10px] text-[#8a7f72] font-bold">{task.time}</span>}
                                </div>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <button onClick={()=>copyTask(task.id)} className="text-emerald-500 bg-emerald-50 p-1.5 rounded-md text-sm" title="複製">📋</button>
                                <button onClick={()=>setEditingTaskId(task.id)} className="text-blue-500 bg-blue-50 p-1.5 rounded-md text-sm" title="編輯">✏️</button>
                                <button onClick={()=>deleteTask(task.id)} className="text-red-500 bg-red-50 p-1.5 rounded-md text-sm" title="刪除">🗑️</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* 驗收區 */}
                  {pbi.acceptedBy ? (
                    <div className="bg-[#fff0f5] border-t-2 border-[#d4a373] p-2 flex items-center justify-between">
                      <div className="text-xs font-bold text-[#9b596f]">✅ 已驗收：{pbi.acceptedBy}（{pbi.acceptedAt}）</div>
                      <button onClick={()=>setTasks(prev=>prev.map(t=>t.id===pbi.id?{...t,acceptedBy:undefined,acceptedAt:undefined}:t))} className="text-[10px] text-[#9b596f] underline ml-2">取消驗收</button>
                    </div>
                  ) : poName ? (
                    <div className="border-t-2 border-[#d4a373] p-2">
                      <button onClick={()=>acceptPbi(pbi.id)} className="w-full bg-[#9b596f] text-white text-xs font-bold py-2 rounded-xl">✅ 驗收確認</button>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {/* 無歸屬任務 */}
            {(() => {
              const unassigned = tasks.filter(t => t.type === 'task' && !t.pbiId);
              const filtered = mobileStatusFilter === 'all' ? unassigned : unassigned.filter(t => t.status === mobileStatusFilter);
              if (filtered.length === 0) return null;
              return (
                <div className="border-2 border-[#b5a695] rounded-2xl overflow-hidden">
                  <div className="bg-[#e8e4d9] p-3 font-bold text-sm text-[#6b5e50]">無歸屬任務</div>
                  <div className="p-2 space-y-2 bg-white">
                    {filtered.map(task => {
                      const isEditing = editingTaskId === task.id;
                      const sC: Record<string,string> = { todo:'bg-[#fceded] text-[#c96262] border-[#e6b1b1]', doing:'bg-[#faebce] text-[#d4a373] border-[#e6c98a]', done:'bg-[#e8eedd] text-[#4a7c59] border-[#a5c2a8]' };
                      const sL: Record<string,string> = { todo:'TO DO', doing:'進行中', done:'完成' };
                      return (
                        <div key={task.id} className="border-2 border-[#b5a695] rounded-xl p-3 bg-[#fffdf9]">
                          {isEditing ? (
                            <div className="space-y-2">
                              <input type="text" value={task.title} onChange={e=>updateTask(task.id,'title',e.target.value)} className="w-full text-sm font-bold p-2 border-2 border-[#b5a695] rounded" placeholder="任務標題" />
                              <textarea value={task.desc||''} onChange={e=>updateTask(task.id,'desc',e.target.value)} className="w-full text-xs p-2 border-2 border-[#b5a695] rounded" rows={2} placeholder="任務說明 (選填)" />
                              <div className="flex gap-2">
                                <input type="text" value={task.role||''} onChange={e=>updateTask(task.id,'role',e.target.value)} className="flex-1 text-xs p-2 border-2 border-[#b5a695] rounded" placeholder="負責人" />
                                <input type="text" value={task.time||''} onChange={e=>updateTask(task.id,'time',e.target.value)} className="flex-1 text-xs p-2 border-2 border-[#b5a695] rounded" placeholder="工時" />
                              </div>
                              <select value={task.status} onChange={e=>updateTask(task.id,'status',e.target.value)} className="w-full text-xs p-2 border-2 border-[#b5a695] rounded bg-white text-[#6b5e50]">
                                <option value="todo">TO DO（待處理）</option>
                                <option value="doing">進行中</option>
                                <option value="done">已完成</option>
                              </select>
                              <div className="flex gap-2">
                                <button onClick={()=>{if(!task.title.trim())updateTask(task.id,'title','未命名項目');setEditingTaskId(null);setTimeout(()=>forceSave&&forceSave(),50);}} className="flex-1 bg-[#8fb996] text-white text-xs font-bold py-2 rounded">確認張貼</button>
                                <button onClick={()=>{if(!task.title.trim())deleteTask(task.id);setEditingTaskId(null);}} className="bg-[#fceded] text-[#c96262] text-xs font-bold px-3 py-2 rounded">取消</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm text-[#3e362e] break-words">{task.title}</div>
                                {task.desc && <div className="text-xs text-[#6b5e50] mt-0.5 break-words whitespace-pre-wrap">{task.desc}</div>}
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${sC[task.status]}`}>{sL[task.status]}</span>
                                  {task.role && <span className="text-[10px] font-bold text-[#5b755e] bg-[#e8eedd] px-1.5 py-0.5 rounded">{task.role}</span>}
                                  {task.time && <span className="text-[10px] text-[#8a7f72] font-bold">{task.time}</span>}
                                </div>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <button onClick={()=>copyTask(task.id)} className="text-emerald-500 bg-emerald-50 p-1.5 rounded-md text-sm" title="複製">📋</button>
                                <button onClick={()=>setEditingTaskId(task.id)} className="text-blue-500 bg-blue-50 p-1.5 rounded-md text-sm" title="編輯">✏️</button>
                                <button onClick={()=>deleteTask(task.id)} className="text-red-500 bg-red-50 p-1.5 rounded-md text-sm" title="刪除">🗑️</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </section>

        {/* 看板區域 (Kanban Board) - 桌面版 */}
        <section className="hidden md:flex bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-xl overflow-hidden flex-col" style={{ minHeight: '650px' }}>
          <div className="bg-[#76a5af] border-b-4 border-[#5b755e] p-4 text-xl font-bold text-white flex justify-between items-center tracking-wider drop-shadow-sm">
            <div className="flex items-center gap-2">
              <span>🎏</span> <ScrumTooltip keyword="Sprint Backlog" text="任務看板 (Sprint Backlog)" />
            </div>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoRestore}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isPhotoRestoring}
                className="bg-[#fffdf9] text-[#467386] border-2 border-[#76a5af] px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-[#daf0f5] transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPhotoRestoring ? '🔍 AI 解析中...' : '📸 從照片還原'}
              </button>
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
                                        <button onClick={() => copyTask(task.id)} className="text-emerald-500 hover:text-emerald-700 bg-emerald-50 p-1.5 rounded-md" title="複製">📋</button>
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
                                        <button onClick={() => { setEditingTaskId(null); setTimeout(() => forceSave && forceSave(), 50); }} className="text-xs font-bold bg-[#5b755e] text-white px-3 py-1 rounded hover:bg-[#4a614d] transition-colors">完成</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <h4 className="text-sm font-bold text-[#3e362e] mb-1 break-all">{task.title || '(未命名項目)'}</h4>
                                      {task.desc && <p className="text-xs text-[#6b5e50] line-clamp-3 mb-2 whitespace-pre-wrap break-words">{task.desc}</p>}
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
                     
                     <div className="flex-1 p-4 bg-[#eac4d0]/10 flex flex-col items-center justify-center min-w-[200px] gap-3">
                       {pbi.acceptedBy ? (
                         <div className="flex flex-col items-center gap-2 border-4 border-[#9b596f] rounded-2xl px-5 py-4 bg-[#fff0f5] shadow-inner w-full text-center">
                           <div className="text-2xl">✅</div>
                           <div className="text-xs font-bold text-[#9b596f] uppercase tracking-widest">已驗收</div>
                           <div className="font-bold text-[#3e362e] text-sm">{pbi.acceptedBy}</div>
                           <div className="text-xs text-[#8a7f72]">{pbi.acceptedAt}</div>
                           <button
                             onClick={() => setTasks(prev => prev.map(t => t.id === pbi.id ? { ...t, acceptedBy: undefined, acceptedAt: undefined } : t))}
                             className="text-[10px] text-[#9b596f] underline hover:text-[#7a3f55] mt-1"
                           >
                             取消驗收
                           </button>
                         </div>
                       ) : (
                         <>
                           <div className="text-[#9b596f]/20 font-bold text-xs transform -rotate-12 select-none">對應 PBI 增量</div>
                           {poName && (
                             <button
                               onClick={() => acceptPbi(pbi.id)}
                               className="bg-[#9b596f] text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-[#7a3f55] transition-all shadow-sm flex items-center gap-1"
                             >
                               ✅ 驗收確認
                             </button>
                           )}
                         </>
                       )}
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
