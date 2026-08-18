"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';

const FIELD_LABELS: Record<string, Record<string, string>> = {
  planning: { sprintName: '專案名稱', goal: 'Sprint Goal', duration: '時間限制', startDate: '開始日期', po: 'PO', sm: 'SM', devs: '開發團隊', stakeholders: '利害關係人', pbis: 'PBI 清單' },
  backlog: { tasks: 'Backlog 任務' },
  'daily-scrum': { tasks: '任務清單', impediments: '阻礙事項' },
  review: { opening: '開場總結', demo: '成果演示', market: '市場討論', future: '展望未來' },
  retrospective: { previousActions: '上次行動', keepStart: 'Keep/Start', problemStop: 'Problem/Stop', actionItems: 'Action Items', actionTracker: '追蹤人' },
};

function trunc(s: string, n = 14) { return s.length > n ? s.slice(0, n) + '…' : s; }

function generateChangeDiff(
  pageKey: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  changedKeys: string[]
): string {
  const labels = FIELD_LABELS[pageKey] || {};
  return changedKeys.map(key => {
    const label = labels[key] || key;
    const oldVal = oldData[key];
    const newVal = newData[key];
    if (Array.isArray(newVal)) {
      const oldLen = Array.isArray(oldVal) ? oldVal.length : 0;
      const newLen = newVal.length;
      if (newLen > oldLen) return `${label}：新增 ${newLen - oldLen} 筆`;
      if (newLen < oldLen) return `${label}：刪除 ${oldLen - newLen} 筆`;
      return `${label}：修改內容`;
    }
    const o = trunc(String(oldVal ?? ''));
    const n = trunc(String(newVal ?? ''));
    if (!o && n) return `${label}：${n}`;
    if (o && !n) return `${label}：已清除`;
    return `${label}：「${o}」→「${n}」`;
  }).filter(Boolean).join('\n');
}

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export function useAutoSave<T>(pageKey: string, initialData: T) {
  const searchParams = useSearchParams();
  const urlSprintIdParam = searchParams.get('sprint');

  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const isDirty = useRef(false);
  const saveGeneration = useRef(0);
  const dataRef = useRef<T>(initialData);
  const userRef = useRef(user);
  const sprintIdRef = useRef<string | null>(null);
  const lastSavedDataRef = useRef<T | null>(null);
  const initialDataRef = useRef<T>(initialData);
  // 本機有未儲存變更時收到的遠端更新：先暫存，等本機存檔落地後再補上，避免遠端變更永久遺失
  const pendingRemoteRef = useRef<Record<string, unknown> | null>(null);

  const [sprintId, setSprintId] = useState<string | null>(null);

  // 動態偵測 sprint 切換（含 Next.js App Router 同路由換 params 的情況）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const newId = urlSprintIdParam || localStorage.getItem('currentSprintId');
    if (urlSprintIdParam) localStorage.setItem('currentSprintId', urlSprintIdParam);

    if (newId === sprintIdRef.current) return; // 未變更，不處理

    // Sprint 切換：重置所有狀態，防止舊 sprint 資料污染新 sprint
    const prevId = sprintIdRef.current;
    sprintIdRef.current = newId;
    setSprintId(newId);

    if (prevId !== null) {
      // 非首次載入才重置（首次 mount 不需要 flash 空資料）
      isDirty.current = false;
      saveGeneration.current++;
      lastSavedDataRef.current = null;
      pendingRemoteRef.current = null;
      setData(initialDataRef.current);
      setLoading(true);
      setSaveStatus('idle');
    }
  }, [urlSprintIdParam]);

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

      const merged = { ...initialData, ...(mainData ?? {}), ...(draftData ?? {}) } as T;
      setData(merged);
      lastSavedDataRef.current = { ...initialData, ...(mainData ?? {}) } as T;
      pendingRemoteRef.current = null;
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

    // viewer_via_link 只對未登入的公開訪客有效；已登入的使用者由 Navigation 非同步校正角色
    const isPublicViewer = !currentUser && localStorage.getItem('sprintRole_' + sid) === 'viewer_via_link';
    if (isPublicViewer) return;

    setSaveStatus('saving');
    // 記錄儲存開始時的編輯世代，用來判斷儲存期間是否有新的用戶編輯
    const genAtStart = saveGeneration.current;

    // 變更欄位在寫入前先算好：既用來決定這次要寫哪些頂層欄位，也沿用給編輯歷史
    const prev = lastSavedDataRef.current as Record<string, unknown> | null;
    const curr = currentData as Record<string, unknown>;
    const changedKeys = prev
      ? Object.keys(curr).filter(k => JSON.stringify(prev[k]) !== JSON.stringify(curr[k]))
      : Object.keys(curr).filter(k => { const v = curr[k]; return v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0); });

    if (currentUser) {
      // 只把「有變動的頂層欄位」放進 payload，其餘欄位（例如 backlog.tasks）完全不帶。
      // 仍使用 setDoc(merge:true)：它會把 payload 併進雲端既有的 map，
      // 沒帶到的欄位原封不動，而巢狀 map（daily.dailyNotes、leaveStatus 等）
      // 也維持逐鍵深合併，不會被整個取代。
      // prev 為 null（首次存檔，文件可能還不存在）時整包寫入以建立文件。
      const pickChanged: Record<string, unknown> = {};
      for (const k of changedKeys) pickChanged[k] = curr[k];
      const payload = prev ? pickChanged : (currentData as unknown as Record<string, unknown>);
      const shouldWrite = !prev || changedKeys.length > 0;

      let lastErr: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt));
          const docRef = doc(db, 'sprints', sid);
          if (shouldWrite) {
            await setDoc(docRef, { [pageKey]: payload }, { merge: true });
          }
          localStorage.removeItem(`draft_sprint_${sid}_${pageKey}`);
          // 只有在儲存期間沒有新的用戶編輯時，才重置 isDirty
          // 避免覆蓋儲存過程中產生的新變更
          if (saveGeneration.current === genAtStart) {
            isDirty.current = false;
          }
          setSaveStatus('saved');
          console.log(`[AutoSave] 雲端儲存成功: ${pageKey}`);
          // 記錄編輯歷史：有實際變更才記錄，無冷卻限制
          if (changedKeys.length > 0) {
            const changes = generateChangeDiff(pageKey, prev ?? {}, curr, changedKeys);
            updateDoc(doc(db, 'sprints', sid), {
              editHistory: arrayUnion({ email: currentUser.email || '', name: currentUser.displayName || currentUser.email || '', ts: Date.now(), page: pageKey, changes })
            }).catch(() => {});
          }
          lastSavedDataRef.current = JSON.parse(JSON.stringify(currentData));
          // 補上先前因本機有未存變更而被暫存的遠端更新（排除這次剛寫出去的欄位，避免自己蓋自己）
          if (pendingRemoteRef.current && !isDirty.current) {
            const pending = pendingRemoteRef.current;
            pendingRemoteRef.current = null;
            const savedKeys = new Set(changedKeys);
            const catchUp: Record<string, unknown> = {};
            for (const k of Object.keys(pending)) {
              if (!savedKeys.has(k)) catchUp[k] = pending[k];
            }
            if (Object.keys(catchUp).length > 0) {
              setData(p => ({ ...p, ...catchUp }));
              lastSavedDataRef.current = { ...(lastSavedDataRef.current as Record<string, unknown>), ...catchUp } as T;
              console.log(`[AutoSave] 補上先前暫存的遠端更新: ${pageKey}`);
            }
          }
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
    const isPublicViewer = !user && localStorage.getItem('sprintRole_' + sprintId) === 'viewer_via_link';
    if (isPublicViewer) return;
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
        if (!snap.exists()) return;

        const remoteData = snap.data()[pageKey];
        if (!remoteData) return;

        // 本機有未儲存的變更，優先保護本機資料；但不能就此丟棄遠端更新，
        // 先暫存起來，等本機存檔完成後再補進來（見 syncToCloud）
        if (isDirty.current) {
          pendingRemoteRef.current = remoteData as Record<string, unknown>;
          console.log(`[AutoSave] 本機編輯中，暫存遠端更新待稍後合併: ${pageKey}`);
          return;
        }

        pendingRemoteRef.current = null;
        setData(prev => ({ ...prev, ...remoteData }));
        // 遠端值即為雲端現況，同步更新基準值，下次存檔才不會把這些欄位當成本機變更再整包寫回
        if (lastSavedDataRef.current) {
          lastSavedDataRef.current = { ...(lastSavedDataRef.current as Record<string, unknown>), ...remoteData } as T;
        }
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
      if (isPublicViewer) return;
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
      // 已登入的使用者不受 viewer_via_link 封鎖（Navigation 會非同步清除舊旗標，這裡先行判斷）
      if (isPublicViewer && !userRef.current) {
        alert('您目前為檢視模式，無法編輯此專案。如需編輯請聯絡擁有者將您加入協作者。');
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
  // opts.markSaved：指定欄位已由呼叫端自行寫入雲端（例如 transaction），
  // 同步更新存檔基準值，避免下次自動存檔又把整個欄位整包寫回覆蓋他人編輯
  const syncData = (
    updates: Partial<T> | ((prev: T) => Partial<T>),
    opts?: { markSaved?: (keyof T & string)[] }
  ) => {
    setData(prev => {
      const newUpdates = typeof updates === 'function' ? updates(prev) : updates;
      const next = { ...prev, ...newUpdates };
      const markSaved = opts?.markSaved;
      if (markSaved && markSaved.length > 0 && lastSavedDataRef.current) {
        const base = { ...(lastSavedDataRef.current as Record<string, unknown>) };
        const nextRecord = next as Record<string, unknown>;
        for (const k of markSaved) {
          const v = nextRecord[k];
          base[k] = v === undefined ? undefined : JSON.parse(JSON.stringify(v));
        }
        lastSavedDataRef.current = base as T;
      }
      return next;
    });
  };

  return { data, updateData, syncData, loading, forceSave, saveStatus };
}
