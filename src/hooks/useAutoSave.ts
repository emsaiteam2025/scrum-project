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

  // 載入資料
  useEffect(() => {
    if (authLoading) return;
    
    // 如果沒有 sprintId (例如從首頁剛進來還沒設定好)，也要停止 loading 狀態，不然畫面會卡住
    if (!sprintId) {
      if (!loading) return; // 已經停止 loading 就不重複
      const timer = setTimeout(() => {
        // 如果 1 秒後還是沒有 sprintId，就強制解除 loading 以免卡住
        if (!localStorage.getItem('currentSprintId')) {
           setLoading(false);
           isFirstLoad.current = false;
        }
      }, 1000);
      return () => clearTimeout(timer);
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
      // 給予一點延遲，避免載入的初始設定觸發第一次的 autosave
      setTimeout(() => {
        isFirstLoad.current = false;
      }, 500);
    };
    loadData();
  }, [user, authLoading, sprintId, pageKey]);

  // 自動儲存
  useEffect(() => {
    if (loading || isFirstLoad.current || !sprintId) return;

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
  }, [data, user, loading, sprintId, pageKey]);

  const updateData = (updates: Partial<T> | ((prev: T) => Partial<T>)) => {
    setData(prev => {
      const newUpdates = typeof updates === 'function' ? updates(prev) : updates;
      return { ...prev, ...newUpdates };
    });
  };

  return { data, updateData, loading };
}
