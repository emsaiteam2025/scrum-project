"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';

interface Sprint {
  id: string;
  name: string;
  createdAt: number;
}

export default function SprintList() {
  const { user, loading: authLoading, signInWithGoogle, logout } = useAuth();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadTimeout, setLoadTimeout] = useState(false);

  useEffect(() => {
    // 如果載入超過 5 秒，顯示逾時提示
    const timer = setTimeout(() => {
      setLoadTimeout(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (authLoading) return; // 等待 Firebase 確認登入狀態

    const fetchSprints = async () => {
      setLoading(true);
      if (user) {
        try {
          const sprintsRef = collection(db, 'users', user.uid, 'sprints');
          const snapshot = await getDocs(sprintsRef);
          if (!snapshot.empty) {
            const loaded = snapshot.docs.map(doc => doc.data() as Sprint).sort((a, b) => b.createdAt - a.createdAt);
            setSprints(loaded);
          } else {
            // 如果剛登入且沒有資料，可以選擇把 local 的塞進去，或給個預設
            const initial = [{ id: `sprint-${Date.now()}`, name: '我的第一個 Sprint', createdAt: Date.now() }];
            setSprints(initial);
            await setDoc(doc(sprintsRef, initial[0].id), initial[0]);
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
            // 過濾掉沒有 ID 的幽靈資料
            const parsedSprints = JSON.parse(saved).filter((s: any) => s && s.id && s.id !== 'default');
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

  const createSprint = async () => {
    const newSprint: Sprint = {
      id: `sprint-${Date.now()}`,
      name: '未命名的新 Sprint',
      createdAt: Date.now()
    };
    const updated = [newSprint, ...sprints];
    setSprints(updated);
    setEditingId(newSprint.id);

    if (user) {
      const sprintRef = doc(db, 'users', user.uid, 'sprints', newSprint.id);
      await setDoc(sprintRef, newSprint);
    } else {
      localStorage.setItem('sprints', JSON.stringify(updated));
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
          await deleteDoc(doc(db, 'users', user.uid, 'sprints', id));
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
        await setDoc(doc(db, 'users', user.uid, 'sprints', id), updatedData, { merge: true });
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
      </div>
    </main>
  );
}
