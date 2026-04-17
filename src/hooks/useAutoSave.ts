"use client";

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';

export function useAutoSave<T>(pageKey: string, initialData: T) {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const isFirstLoad = useRef(true);
  
  const [sprintId, setSprintId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSprintId(localStorage.getItem('currentSprintId'));
    }
  }, []);

  // 防卡死計時器：只要 loading 是 true 就開始計時 3 秒，時間到強制解除
  useEffect(() => {
    if (!loading) return;
    const fallbackTimer = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn("載入資料逾時，已強制解除 Loading 狀態！");
          isFirstLoad.current = false;
          return false;
        }
        return prev;
      });
    }, 3000);
    return () => clearTimeout(fallbackTimer);
  }, [loading]);

  // 載入資料
  useEffect(() => {
    if (authLoading) return;
    
    // 如果沒有 sprintId (或是字串 null/undefined)，提早結束 loading
    if (!sprintId || sprintId === 'null' || sprintId === 'undefined') {
      setLoading(false);
      isFirstLoad.current = false;
      return;
    }

    const loadData = async () => {
      const isPublicViewer = localStorage.getItem('sprintRole_' + sprintId) === 'viewer_via_link';
      
      if (user || isPublicViewer) {
        try {
          const docRef = doc(db, 'sprints', sprintId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data()[pageKey]) {
            setData({ ...initialData, ...docSnap.data()[pageKey] });
          }
        } catch (error) {
          console.error("載入失敗:", error);
        }
      } else {
        try {
          const saved = localStorage.getItem(`sprint_${sprintId}_${pageKey}`);
          if (saved) {
            setData({ ...initialData, ...JSON.parse(saved) });
          }
        } catch (error) {
          console.error("讀取本地資料失敗:", error);
        }
      }
      
      setLoading(false);
      isFirstLoad.current = false;
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, sprintId, pageKey]);

  const [enableSave, setEnableSave] = useState(false);

  // 解除首次載入鎖定
  useEffect(() => {
    if (!loading && isFirstLoad.current) {
      const timer = setTimeout(() => {
        isFirstLoad.current = false;
        setEnableSave(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // 自動儲存
  useEffect(() => {
    if (loading || !enableSave || !sprintId) return;

    const handler = setTimeout(async () => {
      const isPublicViewer = localStorage.getItem('sprintRole_' + sprintId) === 'viewer_via_link';
      if (isPublicViewer && !user) {
        return; // 公開檢視者（未登入）不允許寫入雲端
      }

      if (user) {
        try {
          const docRef = doc(db, 'sprints', sprintId);
          await setDoc(docRef, { [pageKey]: data }, { merge: true });
          console.log(`[Autosave] Cloud sync success: ${pageKey}`);
        } catch (error) {
          console.error("[Autosave] Cloud sync failed:", error);
        }
      } else {
        localStorage.setItem(`sprint_${sprintId}_${pageKey}`, JSON.stringify(data));
        console.log(`[Autosave] Local sync success: ${pageKey}`);
      }
    }, 1000); // 防抖 1 秒

    return () => clearTimeout(handler);
  }, [data, user, loading, sprintId, pageKey, enableSave]);

  const forceSave = async () => {
    if (loading || !sprintId) return;
    const isPublicViewer = localStorage.getItem('sprintRole_' + sprintId) === 'viewer_via_link';
    if (isPublicViewer && !user) return;

    if (user) {
      try {
        const docRef = doc(db, 'sprints', sprintId);
        await setDoc(docRef, { [pageKey]: data }, { merge: true });
        console.log(`[Force Save] Cloud sync success: ${pageKey}`);
      } catch (error) {
        console.error("[Force Save] Cloud sync failed:", error);
      }
    } else {
      localStorage.setItem(`sprint_${sprintId}_${pageKey}`, JSON.stringify(data));
      console.log(`[Force Save] Local sync success: ${pageKey}`);
    }
  };

  const updateData = (updates: Partial<T> | ((prev: T) => Partial<T>)) => {
    if (sprintId) {
      const isPublicViewer = localStorage.getItem('sprintRole_' + sprintId) === 'viewer_via_link';
      // 如果是唯讀訪客，不允許修改本地 state (禁止編輯)
      if (isPublicViewer && !user) {
        alert('您目前為檢視者模式，無法編輯此專案！');
        return;
      }
    }

    setData(prev => {
      const newUpdates = typeof updates === 'function' ? updates(prev) : updates;
      return { ...prev, ...newUpdates };
    });
  };

  return { data, updateData, loading, forceSave };
}
