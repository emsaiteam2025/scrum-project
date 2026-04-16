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
    if (authLoading || !sprintId) return;

    const loadData = async () => {
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid, 'sprints', sprintId);
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
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid, 'sprints', sprintId);
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

  const updateData = (updates: Partial<T>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  return { data, updateData, loading };
}
