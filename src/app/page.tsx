"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, where } from 'firebase/firestore';

interface Sprint {
  id: string;
  name: string;
  createdAt: number;
  ownerId?: string;
  collaborators?: { email: string; role: 'editor' | 'viewer' }[];
  collaboratorEmails?: string[];
}

interface SprintDashboard {
  sprintGoal: string;
  totalTasks: number;
  todo: number;
  doing: number;
  done: number;
  pbiTotal: number;
  pbiAccepted: number;
  startDate: string;
  endDate: string;
}

export default function SprintList() {
  const { user, loading: authLoading, signInWithGoogle, logout } = useAuth();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const [shareModalSprint, setShareModalSprint] = useState<Sprint | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'editor'|'viewer'>('editor');
  const [dashboards, setDashboards] = useState<Record<string, SprintDashboard>>({});
  const [dashLoading, setDashLoading] = useState(false);

  useEffect(() => {
    // 如果載入超過 5 秒，顯示逾時提示
    const timer = setTimeout(() => {
      setLoadTimeout(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // 檢查是否有網址參數，若有且載入完成，直接導向
    const checkLink = async () => {
      if (!loading && !authLoading) {
        const params = new URLSearchParams(window.location.search);
        const targetSprintId = params.get('sprint');
        
        if (targetSprintId) {
          let targetSprint = sprints.find(s => s.id === targetSprintId);
          
          if (!targetSprint) {
            // 從 Firebase 單獨抓取該專案 (給擁有連結的人檢視)
            try {
              const docRef = doc(db, 'sprints', targetSprintId);
              const snap = await getDoc(docRef);
              if (snap.exists()) {
                targetSprint = snap.data() as Sprint;
              }
            } catch (err) {
              console.error(err);
            }
          }

          if (targetSprint) {
            // 找到該專案，自動進入 (設定一個檢視者標記，可供內部後續擴充權限判斷)
            localStorage.setItem('sprintRole_' + targetSprintId, 'viewer_via_link');
            selectSprint(targetSprint.id, targetSprint.name);
          } else {
            alert('找不到此專案！請確認連結是否正確。');
            window.history.replaceState({}, '', '/');
          }
        }
      }
    };
    checkLink();
  }, [sprints, loading, authLoading, user]);

  useEffect(() => {
    if (authLoading) return; // 等待 Firebase 確認登入狀態

    const fetchSprints = async () => {
      setLoading(true);
      if (user) {
        try {
          const sprintsRef = collection(db, 'sprints');
          const qOwned = query(sprintsRef, where('ownerId', '==', user.uid));
          const snapOwned = await getDocs(qOwned);
          
          let sharedDocs: Sprint[] = [];
          if (user.email) {
            const qShared = query(sprintsRef, where('collaboratorEmails', 'array-contains', user.email));
            const snapShared = await getDocs(qShared);
            sharedDocs = snapShared.docs.map(doc => doc.data() as Sprint);
          }
          
          // 合併去重複
          const allDocs = [...snapOwned.docs.map(d => d.data() as Sprint), ...sharedDocs];
          const uniqueDocsMap = new Map();
          allDocs.forEach(d => uniqueDocsMap.set(d.id, d));
          
          let loaded = Array.from(uniqueDocsMap.values());
          if (loaded.length > 0) {
            
            // 過濾並刪除壞掉的雲端資料
            const badDocs = loaded.filter(s => !s || !s.id || s.id === 'default' || !s.createdAt);
            for (const bad of badDocs) {
               try {
                 await deleteDoc(doc(db, 'sprints', bad.id || 'default'));
               } catch(err) { console.error(err) }
            }
            
            loaded = loaded.filter(s => s && s.id && s.id !== 'default' && s.createdAt).sort((a, b) => b.createdAt - a.createdAt);
            setSprints(loaded);
          } else {
            // 如果剛登入且沒有資料，可以選擇把 local 的塞進去，或給個預設
            const initial = [{ id: `sprint-${Date.now()}`, name: '我的第一個 Sprint', createdAt: Date.now() }];
            setSprints(initial);
            await setDoc(doc(db, 'sprints', initial[0].id), { ...initial[0], ownerId: user.uid, collaborators: [] });
          }
        } catch (error) {
          console.error("載入專案失敗:", error);
          alert("讀取雲端資料庫失敗，請確認 Firebase 設定。");
        }
      } else {
        // 未登入，讀取 localStorage
        try {
          const saved = localStorage.getItem('sprints');
          if (saved) {
            // 過濾掉沒有 ID 的幽靈資料或缺乏建立時間的壞資料
            const parsedSprints = JSON.parse(saved).filter((s: Sprint) => s && s.id && s.id !== 'default' && s.createdAt);
            setSprints(parsedSprints);
            // 同步寫回乾淨的資料
            localStorage.setItem('sprints', JSON.stringify(parsedSprints));
          } else {
            setSprints([]);
          }
        } catch (e) {
          console.error("解析 localStorage 失敗:", e);
          setSprints([]);
        }
      }
      setLoading(false);
    };

    fetchSprints();
  }, [user, authLoading]);

  // 載入各 Sprint 的 backlog 進度資料
  useEffect(() => {
    if (loading || sprints.length === 0) return;
    const fetchDashboard = async () => {
      setDashLoading(true);
      const result: Record<string, SprintDashboard> = {};
      await Promise.all(sprints.map(async (sprint) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let backlog: any = null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let planning: any = null;
          if (user) {
            const snap = await getDoc(doc(db, 'sprints', sprint.id));
            if (snap.exists()) {
              backlog = snap.data().backlog ?? null;
              planning = snap.data().planning ?? null;
            }
          } else {
            const localBacklog = localStorage.getItem(`sprint_${sprint.id}_backlog`);
            const localPlanning = localStorage.getItem(`sprint_${sprint.id}_planning`);
            if (localBacklog) backlog = JSON.parse(localBacklog);
            if (localPlanning) planning = JSON.parse(localPlanning);
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tasks: any[] = backlog?.tasks ?? [];
          const allTasks = tasks.filter(t => t.type === 'task');
          const pbis = tasks.filter(t => t.status === 'pbi');
          const startDate: string = planning?.startDate ?? '';
          const sprintDays: number = Number(backlog?.sprintDays ?? 0);
          let endDate = '';
          if (startDate && sprintDays > 0) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + sprintDays - 1);
            endDate = d.toISOString().split('T')[0];
          }
          result[sprint.id] = {
            sprintGoal: backlog?.sprintGoal ?? '',
            totalTasks: allTasks.length,
            todo: allTasks.filter(t => t.status === 'todo').length,
            doing: allTasks.filter(t => t.status === 'doing').length,
            done: allTasks.filter(t => t.status === 'done').length,
            pbiTotal: pbis.length,
            pbiAccepted: pbis.filter(t => t.acceptedBy).length,
            startDate,
            endDate,
          };
        } catch {
          result[sprint.id] = { sprintGoal: '', totalTasks: 0, todo: 0, doing: 0, done: 0, pbiTotal: 0, pbiAccepted: 0, startDate: '', endDate: '' };
        }
      }));
      setDashboards(result);
      setDashLoading(false);
    };
    fetchDashboard();
  }, [sprints, loading, user]);

  const createSprint = async () => {
    const newSprint: Sprint = {
      id: `sprint-${Date.now()}`,
      name: '未命名的新 Sprint',
      createdAt: Date.now(),
      ownerId: user ? user.uid : undefined,
      collaborators: []
    };
    const updated = [newSprint, ...sprints];
    setSprints(updated);
    setEditingId(newSprint.id);

    if (user) {
      const sprintRef = doc(db, 'sprints', newSprint.id);
      await setDoc(sprintRef, newSprint);
    } else {
      localStorage.setItem('sprints', JSON.stringify(updated));
    }
  };

  
  const handleAddCollaborator = async () => {
    if (!shareModalSprint || !shareEmail) return;
    
    let currentCollabs = shareModalSprint.collaborators || [];
    if (currentCollabs.find(c => c.email === shareEmail)) return;
    
    currentCollabs = [...currentCollabs, { email: shareEmail, role: shareRole }];
    const emails = currentCollabs.map(c => c.email);
    
    const updatedData = { collaborators: currentCollabs, collaboratorEmails: emails };
    
    try {
      await setDoc(doc(db, 'sprints', shareModalSprint.id), updatedData, { merge: true });
      // Update local state directly on the modal sprint as well so the UI updates
      setShareModalSprint({ ...shareModalSprint, ...updatedData });
      setSprints(prev => prev.map(s => s.id === shareModalSprint.id ? { ...s, ...updatedData } : s));
      setShareEmail('');
    } catch(err) {
      console.error(err);
    }
  };
  
  const handleRemoveCollaborator = async (email: string) => {
    if (!shareModalSprint) return;
    
    let currentCollabs = shareModalSprint.collaborators || [];
    currentCollabs = currentCollabs.filter(c => c.email !== email);
    const emails = currentCollabs.map(c => c.email);
    
    const updatedData = { collaborators: currentCollabs, collaboratorEmails: emails };
    
    try {
      await setDoc(doc(db, 'sprints', shareModalSprint.id), updatedData, { merge: true });
      setShareModalSprint({ ...shareModalSprint, ...updatedData });
      setSprints(prev => prev.map(s => s.id === shareModalSprint.id ? { ...s, ...updatedData } : s));
    } catch(err) {
      console.error(err);
    }
  };

  const deleteSprint = async (id: string) => {
    if (!id) {
      alert('無法刪除此專案，因為專案 ID 無效（可能為舊的壞資料）。');
      // 仍然將其從畫面移除
      const updated = sprints.filter(s => s.id !== id);
      setSprints(updated);
      if (!user) localStorage.setItem('sprints', JSON.stringify(updated));
      return;
    }

    if (confirm('確定要刪除這個 Sprint 嗎？相關資料將會遺失。')) {
      const updated = sprints.filter(s => s.id !== id);
      setSprints(updated);
      
      if (user) {
        try {
          await deleteDoc(doc(db, 'sprints', id));
        } catch (err) {
          console.error("刪除雲端資料失敗:", err);
        }
      } else {
        localStorage.setItem('sprints', JSON.stringify(updated));
      }

      if (localStorage.getItem('currentSprintId') === id) {
        localStorage.removeItem('currentSprintId');
        localStorage.removeItem('currentSprintName');
      }
    }
  };

  const updateSprintName = async (id: string, newName: string) => {
    if (!id) return;
    const sprintToUpdate = sprints.find(s => s.id === id);
    if (!sprintToUpdate) return;
    const updatedData = { ...sprintToUpdate, name: newName };

    const updated = sprints.map(s => s.id === id ? updatedData : s);
    setSprints(updated);

    if (user) {
      try {
        await setDoc(doc(db, 'sprints', id), updatedData, { merge: true });
      } catch (err) {
        console.error("更新雲端名稱失敗:", err);
      }
    } else {
      localStorage.setItem('sprints', JSON.stringify(updated));
    }
    
    if (localStorage.getItem('currentSprintId') === id) {
      localStorage.setItem('currentSprintName', newName);
    }
  };

  const selectSprint = (id: string, name: string) => {
    localStorage.setItem('currentSprintId', id);
    localStorage.setItem('currentSprintName', name);
    window.location.href = '/planning'; // 導向 Sprint Planning
  };

  return (
    <main className="min-h-screen bg-[#f4f1ea] p-8 font-serif text-[#3e362e] bg-[url('https://www.transparenttextures.com/patterns/rice-paper-2.png')]">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="bg-[#fffdf9] border-4 border-[#5b755e] p-8 rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10 transform translate-x-4 -translate-y-4">
             <span className="text-9xl">📚</span>
          </div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-[#5b755e] drop-shadow-sm flex items-center gap-3">
                <span>📚</span> Sprint 專案大廳
              </h1>
              <p className="text-[#6b5e50] mt-2 font-bold">
                {user 
                  ? `歡迎回來，${user.displayName || '使用者'}！您的專案已同步至雲端。` 
                  : '您目前以訪客身分操作（資料僅存於瀏覽器），登入後即可將專案儲存至雲端！'}
              </p>
            </div>
            
            <div className="flex gap-3">
              {!user ? (
                <button 
                  onClick={signInWithGoogle}
                  className="bg-white text-[#3e362e] px-4 py-3 rounded-xl font-bold shadow-md hover:bg-[#f4f1ea] transition-all border-2 border-[#b5a695] flex items-center gap-2"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                  Google 登入
                </button>
              ) : (
                <button 
                  onClick={logout}
                  className="bg-[#d3cbbd] text-[#6b5e50] px-4 py-3 rounded-xl font-bold shadow-md hover:bg-[#b5a695] hover:text-white transition-all border-2 border-[#b5a695] flex items-center gap-2"
                >
                  登出
                </button>
              )}
              
              <button 
                onClick={createSprint}
                className="bg-[#e07a5f] text-white px-6 py-3 rounded-xl font-bold shadow-md hover:bg-[#c66147] transition-all hover:-translate-y-1 border-2 border-[#8a4231] flex items-center gap-2"
              >
                <span>🌱</span> 建立新 Sprint
              </button>
            </div>
          </div>
        </div>

        {/* 主管儀表板 */}
        {!loading && sprints.length > 0 && (() => {
          const vals = Object.values(dashboards);
          const totalTasks = vals.reduce((s, d) => s + d.totalTasks, 0);
          const totalDone = vals.reduce((s, d) => s + d.done, 0);
          const totalDoing = vals.reduce((s, d) => s + d.doing, 0);
          const totalTodo = vals.reduce((s, d) => s + d.todo, 0);
          const overallRate = totalTasks > 0 ? Math.round(totalDone / totalTasks * 100) : 0;
          const activeCount = vals.filter(d => d.doing > 0 || d.todo > 0).length;
          return (
            <section className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-xl overflow-hidden">
              <div className="bg-[#5b755e] border-b-4 border-[#3d4f3f] p-4 text-xl font-bold text-white flex items-center justify-between">
                <div className="flex items-center gap-2"><span>📊</span> 主管儀表板</div>
                {dashLoading && <div className="text-sm font-normal opacity-70 animate-pulse">載入進度中...</div>}
              </div>

              <div className="p-4 md:p-6 space-y-6">
                {/* 整體統計卡片 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-[#e8eedd] border-2 border-[#a5c2a8] rounded-2xl p-4 text-center">
                    <div className="text-3xl font-bold text-[#4a7c59]">{sprints.length}</div>
                    <div className="text-xs font-bold text-[#5b755e] mt-1">📁 Sprint 總數</div>
                  </div>
                  <div className="bg-[#faebce] border-2 border-[#e6c98a] rounded-2xl p-4 text-center">
                    <div className="text-3xl font-bold text-[#d4a373]">{dashLoading ? '—' : activeCount}</div>
                    <div className="text-xs font-bold text-[#d4a373] mt-1">⚡ 進行中的 Sprint</div>
                  </div>
                  <div className="bg-[#f2e3c6] border-2 border-[#d4a373] rounded-2xl p-4 text-center">
                    <div className="text-3xl font-bold text-[#8b5a2b]">{dashLoading ? '—' : totalTasks}</div>
                    <div className="text-xs font-bold text-[#8b5a2b] mt-1">📋 任務總數</div>
                  </div>
                  <div className="bg-[#c2dce3] border-2 border-[#76a5af] rounded-2xl p-4 text-center">
                    <div className="text-3xl font-bold text-[#467386]">{dashLoading ? '—' : `${overallRate}%`}</div>
                    <div className="text-xs font-bold text-[#467386] mt-1">✅ 整體完成率</div>
                  </div>
                </div>

                {/* 整體進度條 */}
                {!dashLoading && totalTasks > 0 && (
                  <div className="space-y-2">
                    <div className="w-full h-4 rounded-full bg-[#e8e4d9] overflow-hidden flex border-2 border-[#b5a695]">
                      {totalDone > 0 && <div style={{ width: `${Math.round(totalDone/totalTasks*100)}%` }} className="bg-[#8fb996] h-full transition-all duration-700" />}
                      {totalDoing > 0 && <div style={{ width: `${Math.round(totalDoing/totalTasks*100)}%` }} className="bg-[#d4a373] h-full transition-all duration-700" />}
                      {totalTodo > 0 && <div style={{ width: `${Math.round(totalTodo/totalTasks*100)}%` }} className="bg-[#e6b1b1] h-full transition-all duration-700" />}
                    </div>
                    <div className="flex gap-4 text-xs font-bold text-[#8a7f72]">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#8fb996] inline-block"/>完成 {totalDone}</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#d4a373] inline-block"/>進行中 {totalDoing}</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#e6b1b1] inline-block"/>待處理 {totalTodo}</span>
                    </div>
                  </div>
                )}

                {/* 各 Sprint 進度卡片 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sprints.map(sprint => {
                    const d = dashboards[sprint.id];
                    const total = d?.totalTasks ?? 0;
                    const dn = d?.done ?? 0;
                    const dg = d?.doing ?? 0;
                    const td = d?.todo ?? 0;
                    const pbiTotal = d?.pbiTotal ?? 0;
                    const pbiAcc = d?.pbiAccepted ?? 0;
                    const rate = total > 0 ? Math.round(dn / total * 100) : 0;
                    const dgRate = total > 0 ? Math.round(dg / total * 100) : 0;
                    const isOverdue = !!(d?.endDate && new Date(d.endDate) < new Date() && (td > 0 || dg > 0));
                    const statusInfo = dashLoading
                      ? { label: '載入中', cls: 'bg-[#f4f1ea] text-[#b5a695]' }
                      : total === 0
                        ? { label: '尚無任務', cls: 'bg-[#f4f1ea] text-[#8a7f72]' }
                        : td === 0 && dg === 0
                          ? { label: '✅ 已完成', cls: 'bg-[#e8eedd] text-[#4a7c59]' }
                          : dg > 0
                            ? { label: '⚡ 進行中', cls: 'bg-[#faebce] text-[#d4a373]' }
                            : { label: '📋 待開始', cls: 'bg-[#fceded] text-[#c96262]' };
                    return (
                      <div key={sprint.id} onClick={() => selectSprint(sprint.id, sprint.name)}
                        className="bg-[#faf8f5] border-2 border-[#e8d5b5] rounded-2xl p-5 cursor-pointer hover:border-[#8fb996] hover:shadow-md transition-all flex flex-col gap-3">

                        {/* 名稱 + 狀態 */}
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-bold text-[#3e362e] text-base leading-tight flex-1">{sprint.name}</h3>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${statusInfo.cls}`}>{statusInfo.label}</span>
                        </div>

                        {/* Sprint 目標 */}
                        <p className="text-xs text-[#6b5e50] line-clamp-2 min-h-[2rem]">
                          {d?.sprintGoal || <span className="text-[#d3cbbd] italic">尚未設定 Sprint 目標</span>}
                        </p>

                        {/* 日期範圍 */}
                        <div className="flex items-center gap-2 text-xs bg-[#f4f1ea] rounded-lg px-3 py-2">
                          <span>📅</span>
                          {dashLoading ? (
                            <span className="text-[#d3cbbd]">載入中...</span>
                          ) : d?.startDate ? (
                            <span className="font-bold text-[#6b5e50]">{new Date(d.startDate).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                          ) : <span className="text-[#d3cbbd]">開始日未設定</span>}
                          <span className="text-[#b5a695] font-bold">→</span>
                          {!dashLoading && (d?.endDate ? (
                            <span className={`font-bold ${isOverdue ? 'text-[#c96262]' : 'text-[#6b5e50]'}`}>
                              {new Date(d.endDate).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                              {isOverdue && <span className="ml-1.5 text-[10px] bg-[#fceded] text-[#c96262] px-1.5 py-0.5 rounded-full border border-[#e6b1b1]">已逾期</span>}
                            </span>
                          ) : <span className="text-[#d3cbbd]">結束日未設定</span>)}
                        </div>

                        {/* 進度條 */}
                        <div>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-[#8a7f72] font-bold">任務完成率</span>
                            <span className="font-bold text-[#5b755e]">{dashLoading ? '—' : total > 0 ? `${rate}%` : '尚無任務'}</span>
                          </div>
                          <div className="w-full h-3.5 rounded-full bg-[#e8e4d9] overflow-hidden flex border border-[#d3cbbd]">
                            {dashLoading ? (
                              <div className="w-full h-full bg-[#e0dbd3] animate-pulse" />
                            ) : (
                              <>
                                {dn > 0 && <div style={{ width: `${rate}%` }} className="bg-[#8fb996] h-full transition-all duration-700" />}
                                {dg > 0 && <div style={{ width: `${dgRate}%` }} className="bg-[#d4a373] h-full transition-all duration-700" />}
                              </>
                            )}
                          </div>
                        </div>

                        {/* 統計數字 */}
                        <div className="flex justify-between items-center border-t border-[#f0ebe4] pt-3">
                          <div className="flex gap-5">
                            <div className="text-center">
                              <div className={`text-2xl font-bold leading-none ${dn > 0 ? 'text-[#4a7c59]' : 'text-[#d3cbbd]'}`}>{dashLoading ? '—' : dn}</div>
                              <div className="text-[10px] text-[#8a7f72] font-bold mt-1">✅ 完成</div>
                            </div>
                            <div className="text-center">
                              <div className={`text-2xl font-bold leading-none ${dg > 0 ? 'text-[#d4a373]' : 'text-[#d3cbbd]'}`}>{dashLoading ? '—' : dg}</div>
                              <div className="text-[10px] text-[#8a7f72] font-bold mt-1">⚡ 進行中</div>
                            </div>
                            <div className="text-center">
                              <div className={`text-2xl font-bold leading-none ${td > 0 ? 'text-[#c96262]' : 'text-[#d3cbbd]'}`}>{dashLoading ? '—' : td}</div>
                              <div className="text-[10px] text-[#8a7f72] font-bold mt-1">📋 待處理</div>
                            </div>
                          </div>
                          <div className="text-center border-l border-[#e8d5b5] pl-5">
                            <div className={`text-2xl font-bold leading-none ${pbiAcc > 0 ? 'text-[#9b596f]' : 'text-[#d3cbbd]'}`}>{dashLoading ? '—' : `${pbiAcc}/${pbiTotal}`}</div>
                            <div className="text-[10px] text-[#8a7f72] font-bold mt-1">🍄 PBI 驗收</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })()}

        {/* 專案清單 */}
        {loading ? (
          <div className="text-center py-12 text-[#b5a695] font-bold text-lg flex flex-col items-center gap-4">
            <div>資料載入中...</div>
            {loadTimeout && (
              <div className="text-[#c96262] text-sm bg-[#fceded] p-4 rounded-xl border border-[#e6b1b1] max-w-md">
                ⚠️ 讀取時間似乎有點久。這可能是因為您的網路連線不穩，或是 Firebase 資料庫連線失敗。
                <br /><br />
                您可以嘗試重新整理網頁，或先使用下方的「建立新 Sprint」在本地端操作。
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sprints.map(sprint => {
              const isEditing = editingId === sprint.id;
              const isCurrent = typeof window !== 'undefined' && localStorage.getItem('currentSprintId') === sprint.id;

              return (
                <div 
                  key={sprint.id} 
                  className={`bg-[#fffdf9] border-4 rounded-3xl p-6 shadow-lg transition-all group relative
                    ${isCurrent ? 'border-[#e07a5f] ring-4 ring-[#e07a5f]/20' : 'border-[#8fb996] hover:-translate-y-1 hover:shadow-xl'}
                  `}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 -right-3 bg-[#e07a5f] text-white text-xs font-bold px-3 py-1 rounded-full shadow-md border-2 border-[#8a4231]">
                      當前開啟
                    </div>
                  )}
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-xs font-bold text-[#b5a695] bg-[#f4f1ea] px-2 py-1 rounded">
                      {new Date(sprint.createdAt).toLocaleDateString()} 建立
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setShareModalSprint(sprint); }} 
                        className="text-[#8b5a2b] hover:bg-[#faebce] p-1.5 rounded transition-colors"
                        title="共享設定"
                      >
                        👥
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingId(isEditing ? null : sprint.id); }} 
                        className="text-[#76a5af] hover:bg-[#e8eedd] p-1.5 rounded transition-colors"
                        title="編輯名稱"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteSprint(sprint.id); }} 
                        className="text-[#c96262] hover:bg-[#fceded] p-1.5 rounded transition-colors"
                        title="刪除"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div className="min-h-[80px] mb-4">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input 
                          type="text" 
                          value={sprint.name} 
                          onChange={(e) => updateSprintName(sprint.id, e.target.value)}
                          className="w-full px-3 py-2 border-2 border-[#b5a695] rounded-lg focus:outline-none focus:border-[#5b755e] text-[#3e362e] font-bold"
                          autoFocus
                        />
                        <button 
                          onClick={() => setEditingId(null)}
                          className="bg-[#8fb996] text-white text-xs font-bold px-4 py-2 rounded hover:bg-[#5b755e] transition-colors w-full"
                        >
                          儲存名稱
                        </button>
                      </div>
                    ) : (
                      <h2 className="text-xl font-bold text-[#3e362e] leading-snug line-clamp-3">
                        {sprint.name}
                      </h2>
                    )}
                  </div>

                  {!isEditing && (
                    <button 
                      onClick={() => selectSprint(sprint.id, sprint.name)}
                      className={`w-full py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 border-2
                        ${isCurrent 
                          ? 'bg-[#e07a5f] text-white border-[#8a4231] hover:bg-[#c66147]' 
                          : 'bg-[#e8eedd] text-[#5b755e] border-[#8fb996] hover:bg-[#dcedc1]'
                        }
                      `}
                    >
                      <span>{isCurrent ? '繼續編輯此 Sprint' : '進入此 Sprint'}</span>
                      <span>→</span>
                    </button>
                  )}
                </div>
              );
            })}
            
            {sprints.length === 0 && (
              <div className="col-span-1 md:col-span-2 text-center py-12 text-[#b5a695] font-bold text-lg bg-[#fffdf9] border-4 border-dashed border-[#b5a695] rounded-3xl">
                🪹 目前還沒有任何 Sprint，點擊右上角建立一個吧！
              </div>
            )}
          </div>
        )}
      
        {/* Share Modal */}
        {shareModalSprint && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl p-6 shadow-2xl max-w-md w-full relative">
               <button onClick={() => setShareModalSprint(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold text-xl">✕</button>
               <h2 className="text-xl font-bold text-[#5b755e] mb-4 flex items-center gap-2"><span>👥</span> 共享專案</h2>
               <p className="text-sm font-bold text-[#6b5e50] mb-4">專案名稱：{shareModalSprint.name}</p>
               
               
               <div className="bg-[#e8eedd] border-2 border-[#5b755e] rounded-xl p-4 mb-4">
                  <h3 className="font-bold text-sm text-[#3e362e] mb-2 flex justify-between items-center">
                    專案專屬網址
                    <button 
                      onClick={() => {
                        const url = `${window.location.origin}/?sprint=${shareModalSprint.id}`;
                        navigator.clipboard.writeText(url);
                        alert('已複製連結！取得此連結的人將可以直接進入檢視此專案內容。');
                      }}
                      className="text-xs bg-white border-2 border-[#5b755e] px-2 py-1 rounded-lg text-[#5b755e] hover:bg-[#5b755e] hover:text-white transition-colors shadow-sm"
                    >
                      📋 複製
                    </button>
                  </h3>
                  <input 
                    type="text" 
                    readOnly 
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/?sprint=${shareModalSprint.id}`} 
                    className="w-full p-2 border-2 border-[#b5a695] rounded-lg bg-white text-xs text-[#6b5e50] outline-none focus:border-[#5b755e]"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
               </div>

               <div className="bg-[#f4f1ea] border-2 border-[#b5a695] rounded-xl p-4 mb-4">
                  <h3 className="font-bold text-sm text-[#3e362e] mb-2">已加入的協作者</h3>
                  {(!shareModalSprint.collaborators || shareModalSprint.collaborators.length === 0) ? (
                    <div className="text-xs text-[#8a7f72] py-2">目前沒有協作者</div>
                  ) : (
                    <ul className="space-y-2">
                       {shareModalSprint.collaborators.map(c => (
                         <li key={c.email} className="flex justify-between items-center text-sm font-bold bg-white px-3 py-2 border border-[#d3cbbd] rounded-lg">
                           <span className="truncate flex-1 text-[#3e362e]">{c.email}</span>
                           <span className="text-xs px-2 py-1 bg-[#e8eedd] text-[#4a7c59] rounded mx-2">{c.role === 'editor' ? '編輯' : '檢視'}</span>
                           <button onClick={() => handleRemoveCollaborator(c.email)} className="text-red-500 hover:text-red-700">🗑️</button>
                         </li>
                       ))}
                    </ul>
                  )}
               </div>
               
               <div className="space-y-3">
                 <h3 className="font-bold text-sm text-[#3e362e]">新增協作者 (Google Email)</h3>
                 <div className="flex gap-2">
                   <input 
                     type="email" 
                     value={shareEmail} 
                     onChange={e => setShareEmail(e.target.value)} 
                     placeholder="輸入Email..."
                     className="flex-1 p-2 border-2 border-[#b5a695] rounded-lg focus:outline-none focus:border-[#5b755e] font-bold text-sm"
                   />
                   <select 
                     value={shareRole} 
                     onChange={e => setShareRole(e.target.value as 'editor'|'viewer')}
                     className="p-2 border-2 border-[#b5a695] rounded-lg bg-white focus:outline-none font-bold text-sm text-[#6b5e50]"
                   >
                     <option value="editor">編輯</option>
                     <option value="viewer">檢視</option>
                   </select>
                 </div>
                 <button 
                   onClick={handleAddCollaborator}
                   className="w-full bg-[#5b755e] text-white font-bold py-2 rounded-lg hover:bg-[#4a614d] transition-colors"
                 >
                   邀請加入
                 </button>
               </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
