"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export function useAutoSave<T>(pageKey: string, initialData: T) {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const isDirty = useRef(false);
  const saveGeneration = useRef(0); // 每次用戶編輯時遞增，用來偵測儲存期間是否有新編輯
  const dataRef = useRef<T>(initialData);
  const userRef = useRef(user);
  const sprintIdRef = useRef<string | null>(null);

  const [sprintId, setSprintId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const id = localStorage.getItem('currentSprintId');
      setSprintId(id);
      sprintIdRef.current = id;
    }
  }, []);

  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { userRef.current = user; }, [user]);

  // 防卡死計時器：3 秒後強制解除 loading
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => {
      console.warn('[AutoSave] 載入逾時，強制解除 loading');
      setLoading(false);
    }, 3000);
    return () => clearTimeout(t);
  }, [loading]);

  // 載入資料
  useEffect(() => {
    if (authLoading) return;

    if (!sprintId || sprintId === 'null' || sprintId === 'undefined') {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      const isPublicViewer = localStorage.getItem('sprintRole_' + sprintId) === 'viewer_via_link';
      let mainData: Partial<T> | null = null;

      if (user || isPublicViewer) {
        try {
          const docRef = doc(db, 'sprints', sprintId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data()[pageKey]) {
            mainData = docSnap.data()[pageKey];
          }
        } catch (err) {
          console.error('[AutoSave] 雲端載入失敗:', err);
        }
      } else {
        try {
          const saved = localStorage.getItem(`sprint_${sprintId}_${pageKey}`);
          if (saved) mainData = JSON.parse(saved);
        } catch (err) {
          console.error('[AutoSave] 本地載入失敗:', err);
        }
      }

      // 草稿：上次未儲存成功的資料（優先級最高）
      let draftData: Partial<T> | null = null;
      try {
        const draft = localStorage.getItem(`draft_sprint_${sprintId}_${pageKey}`);
        if (draft) {
          draftData = JSON.parse(draft);
          console.log(`[AutoSave] 發現未儲存草稿，已恢復: ${pageKey}`);
        }
      } catch {}

      setData({ ...initialData, ...(mainData ?? {}), ...(draftData ?? {}) } as T);
      if (draftData) {
        isDirty.current = true;
        saveGeneration.current++;
      } else {
        isDirty.current = false;
      }
      setLoading(false);
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, sprintId, pageKey]);

  const syncToCloud = useCallback(async (currentData: T) => {
    const sid = sprintIdRef.current;
    const currentUser = userRef.current;
    if (!sid) return;

    const isPublicViewer = localStorage.getItem('sprintRole_' + sid) === 'viewer_via_link';
    if (isPublicViewer && !currentUser) return;

    setSaveStatus('saving');
    // 記錄儲存開始時的編輯世代，用來判斷儲存期間是否有新的用戶編輯
    const genAtStart = saveGeneration.current;

    if (currentUser) {
      let lastErr: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt));
          const docRef = doc(db, 'sprints', sid);
          await setDoc(docRef, { [pageKey]: currentData }, { merge: true });
          localStorage.removeItem(`draft_sprint_${sid}_${pageKey}`);
          // 只有在儲存期間沒有新的用戶編輯時，才重置 isDirty
          // 避免覆蓋儲存過程中產生的新變更
          if (saveGeneration.current === genAtStart) {
            isDirty.current = false;
          }
          setSaveStatus('saved');
          console.log(`[AutoSave] 雲端儲存成功: ${pageKey}`);
          setTimeout(() => setSaveStatus('idle'), 2000);
          return;
        } catch (err) {
          lastErr = err;
          console.warn(`[AutoSave] 儲存失敗 (嘗試 ${attempt + 1}/3):`, err);
        }
      }
      console.error('[AutoSave] 雲端儲存失敗（草稿已保留）:', lastErr);
      setSaveStatus('error');
    } else {
      localStorage.setItem(`sprint_${sid}_${pageKey}`, JSON.stringify(currentData));
      localStorage.removeItem(`draft_sprint_${sid}_${pageKey}`);
      if (saveGeneration.current === genAtStart) {
        isDirty.current = false;
      }
      setSaveStatus('saved');
      console.log(`[AutoSave] 本地儲存成功: ${pageKey}`);
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  }, [pageKey]);

  // 即時 localStorage 草稿備份（最後防線，每次 data 變動同步寫入）
  useEffect(() => {
    if (loading || !isDirty.current || !sprintId) return;
    const isPublicViewer = localStorage.getItem('sprintRole_' + sprintId) === 'viewer_via_link';
    if (isPublicViewer && !user) return;
    try {
      localStorage.setItem(`draft_sprint_${sprintId}_${pageKey}`, JSON.stringify(data));
    } catch {}
  }, [data, loading, sprintId, pageKey, user]);

  // 防抖 1 秒後同步雲端
  useEffect(() => {
    if (loading || !isDirty.current || !sprintId) return;
    setSaveStatus('pending');
    const t = setTimeout(() => syncToCloud(data), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading, sprintId, syncToCloud]);

  const forceSave = useCallback(async () => {
    if (!isDirty.current) return;
    await syncToCloud(dataRef.current);
  }, [syncToCloud]);

  // 即時監聽遠端變更：其他裝置儲存後，自動同步到本機（不觸發 isDirty）
  useEffect(() => {
    if (!sprintId || !user || loading) return;

    const isPublicViewer = localStorage.getItem('sprintRole_' + sprintId) === 'viewer_via_link';
    if (isPublicViewer) return;

    let isFirstSnapshot = true;
    const docRef = doc(db, 'sprints', sprintId);
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        // 第一次快照是初始載入的 echo，跳過避免覆蓋草稿
        if (isFirstSnapshot) {
          isFirstSnapshot = false;
          return;
        }
        // hasPendingWrites = true 表示是本機自己的寫入回傳，跳過
        if (snap.metadata.hasPendingWrites) return;
        // 本機有未儲存的變更，優先保護本機資料，避免遠端資料覆蓋
        if (isDirty.current) return;
        if (!snap.exists()) return;

        const remoteData = snap.data()[pageKey];
        if (!remoteData) return;

        setData(prev => ({ ...prev, ...remoteData }));
        console.log(`[AutoSave] 接收遠端即時更新: ${pageKey}`);
      },
      (error) => {
        console.warn('[AutoSave] 即時監聽暫時中斷:', error);
      }
    );

    return () => unsubscribe();
  }, [sprintId, user, pageKey, loading]);

  // 組件 unmount 時（client-side 換頁）同步寫入 draft，防止 debounce 被 cleanup 取消
  useEffect(() => {
    return () => {
      if (!isDirty.current || !sprintIdRef.current) return;
      const sid = sprintIdRef.current;
      const isPublicViewer = localStorage.getItem('sprintRole_' + sid) === 'viewer_via_link';
      if (isPublicViewer && !userRef.current) return;
      try {
        localStorage.setItem(`draft_sprint_${sid}_${pageKey}`, JSON.stringify(dataRef.current));
      } catch {}
    };
  }, [pageKey]);

  // 頁面切換 / 關閉時強制儲存
  useEffect(() => {
    const handleHide = () => {
      if (document.visibilityState === 'hidden' && isDirty.current) {
        forceSave();
      }
    };
    const handlePageHide = () => {
      if (isDirty.current) forceSave();
    };
    document.addEventListener('visibilitychange', handleHide);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleHide);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [forceSave]);

  const updateData = (updates: Partial<T> | ((prev: T) => Partial<T>)) => {
    if (sprintId) {
      const isPublicViewer = localStorage.getItem('sprintRole_' + sprintId) === 'viewer_via_link';
      if (isPublicViewer && !user) {
        alert('您目前為檢視者模式，無法編輯此專案！');
        return;
      }
    }
    isDirty.current = true;
    saveGeneration.current++;
    setData(prev => {
      const newUpdates = typeof updates === 'function' ? updates(prev) : updates;
      return { ...prev, ...newUpdates };
    });
  };

  // 背景同步用：更新 state 但不標記為 dirty，避免觸發不必要的儲存
  const syncData = (updates: Partial<T> | ((prev: T) => Partial<T>)) => {
    setData(prev => {
      const newUpdates = typeof updates === 'function' ? updates(prev) : updates;
      return { ...prev, ...newUpdates };
    });
  };

  return { data, updateData, syncData, loading, forceSave, saveStatus };
}
