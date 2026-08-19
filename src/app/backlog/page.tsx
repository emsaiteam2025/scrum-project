"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useAutoSave } from '@/hooks/useAutoSave';
import Navigation from '@/components/Navigation';
import ScrumTooltip from '@/components/ScrumTooltip';
import SaveIndicator from '@/components/SaveIndicator';
import { jDays } from '@/lib/journal';
import type { Task, DevMember, Subtask, Attachment, ProgressNote } from '@/lib/taskTypes';
import { parseRoleNames } from '@/lib/taskTypes';
import SubtaskList from '@/components/SubtaskList';
import AttachmentBox from '@/components/AttachmentBox';
import ProgressLog from '@/components/ProgressLog';
import { isSprintAdmin } from '@/lib/permissions';
import { useAuth } from '@/components/AuthProvider';
import { updateTaskInSprint, appendNoteInSprint, deleteNoteInSprint, makeNote } from '@/lib/myTasks';
import {
  Camera, Kanban, Target, BarChart2,
  ChevronUp, ChevronDown, Copy, Pencil, Trash2,
  Bot, Plus, Save, CheckCircle2, Layers, Palette, X,
} from 'lucide-react';

const initialTasks: Task[] = [];

// Sprint Planning 的「時間限制」是週數（'1'~'4'）或 '30d'，這裡轉成人看得懂的標籤
const timeLimitLabel = (tl: unknown): string =>
  tl === '30d' ? '30 天' : `${tl} 週`;

export default function Backlog() {
  const [planningTimeLabel, setPlanningTimeLabel] = useState<string>('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [colorPickerTaskId, setColorPickerTaskId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isPhotoRestoring, setIsPhotoRestoring] = useState(false);
  const [poName, setPoName] = useState<string>('');
  const [sprintStartDate, setSprintStartDate] = useState<string>('');
  const [holidays, setHolidays] = useState<{ id: string; date: string; name: string }[]>([]);
  const [mobileStatusFilter, setMobileStatusFilter] = useState<'all' | 'todo' | 'doing' | 'done'>('all');
  const [dateLabel, setDateLabel] = useState<string>('');
  // sprintOwnerId 供子任務權限判斷使用（判斷誰是 Scrum Master／擁有者）
  const [sprintOwnerId, setSprintOwnerId] = useState<string | undefined>(undefined);
  const { user } = useAuth();
  // 子任務與附件都需要 sprintId；不可在 JSX 內直接讀 localStorage（會造成 hydration 不一致）
  const [currentSprintId, setCurrentSprintId] = useState('');
  useEffect(() => { setCurrentSprintId(localStorage.getItem('currentSprintId') || ''); }, []);
  // 公開連結的檢視者（未登入且帶 viewer_via_link 旗標）不得上傳／刪除附件或編輯子任務。
  // 已登入且有編輯權的使用者，Navigation 會非同步清掉舊旗標，所以這裡用 !user 一起判斷。
  // 必須在 effect 內讀 localStorage，避免 SSR/CSR hydration 不一致。
  const [isViewOnly, setIsViewOnly] = useState(false);
  useEffect(() => {
    if (!currentSprintId) { setIsViewOnly(false); return; }
    setIsViewOnly(!user && localStorage.getItem('sprintRole_' + currentSprintId) === 'viewer_via_link');
  }, [user, currentSprintId]);
  useEffect(() => {
    setDateLabel(new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }));
  }, []);
  const photoRestoredAt = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deletedPbiIds = useRef<Set<string>>(new Set());

  const { data, updateData, syncData, loading, forceSave, saveStatus } = useAutoSave('backlog', {
    sprintDays: 30 as number | string,
    tasks: initialTasks,
    sprintGoal: '',
    stakeholders: '',
    devsList: [] as string[],
    // devsList 是既有的純姓名陣列（UI 在用，型別不可動）；
    // devMembers 是新增的姓名＋Email，供子任務綁定身分使用。
    devMembers: [] as DevMember[],
    planning: null as null | { po?: string; sm?: string; devsList?: { name: string; role?: string; email?: string }[] },
  });

  // 擁有者／PO／SM 可刪除任何人的進度紀錄；一般成員只能刪自己的
  const canDeleteAnyNote = isSprintAdmin({ ownerId: sprintOwnerId }, data.planning, user);

  const sprintDays = data.sprintDays;
  const tasks = data.tasks;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setTasks = (valOrFn: Task[] | ((prev: Task[]) => Task[])) => {
    updateData((prevData: {tasks: Task[]}) => ({
      tasks: typeof valOrFn === 'function' ? valOrFn(prevData.tasks) : valOrFn
    }));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setSyncTasks = (
    valOrFn: Task[] | ((prev: Task[]) => Task[]),
    opts?: { markSaved?: boolean }
  ) => {
    syncData(
      (prevData: {tasks: Task[]}) => ({
        tasks: typeof valOrFn === 'function' ? valOrFn(prevData.tasks) : valOrFn
      }),
      opts?.markSaved ? { markSaved: ['tasks'] } : undefined
    );
  };

  useEffect(() => {
    if (sprintDays) {
      localStorage.setItem('sprintDays', sprintDays.toString());
    }
  }, [sprintDays]);

  // 週期天數以 Sprint Planning 為單一來源，這裡用 ref 讓 5 秒輪詢的同步不會讀到過期的閉包值
  // （否則每輪都會誤判成「不一致」而重複觸發儲存）
  const sprintDaysRef = useRef<number | string>(sprintDays);
  useEffect(() => { sprintDaysRef.current = sprintDays; }, [sprintDays]);

  useEffect(() => {
    if (loading) return;
    const syncWhatsFromPlanning = async () => {
      try {
        if (Date.now() - photoRestoredAt.current < 15000) return;
        const sprintId = localStorage.getItem('currentSprintId');
        if (!sprintId) return;
        const { getAuth } = await import('firebase/auth');
        const { doc, getDoc } = await import('firebase/firestore');
        const { db, app } = await import('@/lib/firebase');
        const auth = getAuth(app);
        const isPublicViewer = localStorage.getItem('sprintRole_' + sprintId) === 'viewer_via_link';
        let planningData = null;
        if (auth.currentUser || isPublicViewer) {
          const docRef = doc(db, 'sprints', sprintId);
          const snap = await getDoc(docRef);
          if (snap.exists()) setSprintOwnerId(snap.data().ownerId);
          if (snap.exists() && snap.data().planning) {
            planningData = snap.data().planning;
          }
        } else {
          const localStr = localStorage.getItem(`sprint_${sprintId}_planning`);
          if (localStr) planningData = JSON.parse(localStr);
        }
        if (planningData) {
          // 週期天數：由 Planning 的時間限制換算後帶入（1~4 週 → 7/14/21/28 天、30d → 30 天）
          const tl = planningData.timeLimit || planningData.duration;
          if (tl) {
            setPlanningTimeLabel(timeLimitLabel(tl));
            const days = jDays(tl);
            if (days > 0 && Number(sprintDaysRef.current) !== days && (!isPublicViewer || auth.currentUser)) {
              updateData({ sprintDays: days });
              localStorage.setItem('sprintDays', String(days));
            }
          }
          if (planningData.devs || planningData.devsList) {
            const structured: { name: string; role?: string; email?: string }[] = Array.isArray(planningData.devsList)
              ? planningData.devsList
              : [];
            const fromStructured = structured
              .map(d => ({ name: (d.name || '').trim(), email: (d.email || '').trim().toLowerCase() }))
              .filter(d => d.name);
            // 舊資料沒有 devsList，退回用逗號字串拆姓名（此時沒有 email 可綁）
            const fromString = (planningData.devs || '')
              .split(/[,、，\n]/)
              .map((d: string) => d.trim())
              .filter((d: string) => d)
              .map((name: string) => ({ name, email: '' }));
            const members: DevMember[] = fromStructured.length > 0 ? fromStructured : fromString;

            if (!isPublicViewer || auth.currentUser) {
              syncData({
                devsList: members.map(m => m.name),
                devMembers: members,
                planning: {
                  po: planningData.po || '',
                  sm: planningData.sm || '',
                  devsList: structured,
                },
              });
            }
          }
          if (planningData.whats) {
            const whats = planningData.whats.filter((w: {id: string, text: string}) => w.text && w.text.trim() !== '');
            if (!isPublicViewer || auth.currentUser) {
              setSyncTasks(prev => {
                let newPbis = prev.filter(t => t.type === 'pbi');
                const tasksList = prev.filter(t => t.type === 'task');
                whats.forEach((w: {id: string, text: string}) => {
                  const existingIndex = newPbis.findIndex(t => t.id === w.id);
                  if (existingIndex >= 0) {
                    if (newPbis[existingIndex].title !== w.text) {
                      newPbis[existingIndex] = { ...newPbis[existingIndex], title: w.text };
                    }
                  } else {
                    if (!deletedPbiIds.current.has(w.id)) {
                      newPbis.push({ id: w.id, type: 'pbi', status: 'pbi', title: w.text });
                    }
                  }
                });
                const whatIds = whats.map((w: {id: string, text: string}) => w.id);
                const planningIds = new Set(whatIds);
                newPbis = newPbis.filter(t =>
                  !deletedPbiIds.current.has(t.id) &&
                  (planningIds.has(t.id) || t.id.startsWith('photo-') || t.id.startsWith('pbi-'))
                );
                const mergedTasks = [...newPbis, ...tasksList];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const hashTask = (t: any) => `${t.id}|${t.title}|${t.desc}|${t.status}|${t.role}|${t.time}|${t.pbiId}`;
                const prevHash = prev.map(hashTask).sort().join(',');
                const mergedHash = mergedTasks.map(hashTask).sort().join(',');
                if (prevHash !== mergedHash) return mergedTasks;
                return prev;
              });
            }
          }
        }
      } catch (err) {
        console.error("Sync PBI failed:", err);
      }
    };
    syncWhatsFromPlanning();
    const interval = setInterval(syncWhatsFromPlanning, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) setApiKey(savedKey);
    try {
      const raw = localStorage.getItem('orgHolidays');
      if (raw) setHolidays(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    const sprintId = localStorage.getItem('currentSprintId');
    if (!sprintId) return;
    try {
      const stored = localStorage.getItem(`deleted_pbis_${sprintId}`);
      if (stored) deletedPbiIds.current = new Set(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    if (loading) return;
    if (deletedPbiIds.current.size === 0) return;
    const hasRestored = tasks.some(t => t.type === 'pbi' && deletedPbiIds.current.has(t.id));
    if (hasRestored) {
      setTasks((prev: Task[]) => prev.filter(t => !(t.type === 'pbi' && deletedPbiIds.current.has(t.id))));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, loading]);

  useEffect(() => {
    const sprintId = localStorage.getItem('currentSprintId');
    if (!sprintId) return;
    const loadPo = async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const snap = await getDoc(doc(db, 'sprints', sprintId));
        if (snap.exists()) {
          if (snap.data().planning?.po) setPoName(snap.data().planning.po);
          if (snap.data().planning?.startDate) setSprintStartDate(snap.data().planning.startDate);
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
    setTimeout(() => forceSave && forceSave(), 100);
  };

  const cancelAcceptPbi = (id: string) => {
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, acceptedBy: undefined, acceptedAt: undefined } : t
    ));
    setTimeout(() => forceSave && forceSave(), 100);
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
      const { base64: imageBase64, mimeType: compressedMimeType } = await new Promise<{ base64: string; mimeType: string }>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const MAX_WIDTH = 1500; const MAX_HEIGHT = 3000;
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
      if (!Array.isArray(restoredTasks)) throw new Error('AI 回傳格式錯誤，請重試');
      setTasks(restoredTasks);
      photoRestoredAt.current = Date.now();
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

  const onDragStart = (e: React.DragEvent, task: Task) => {
    if (editingTaskId === task.id) { e.preventDefault(); return; }
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.setData('taskType', task.type);
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const onDrop = (e: React.DragEvent, targetStatus: Task['status'], targetTaskId?: string, targetPbiId?: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('taskId');
    if (!id) return;
    setTasks((prevTasks: Task[]) => {
      const taskIndex = prevTasks.findIndex(t => t.id === id);
      if (taskIndex === -1) return prevTasks;
      const task = prevTasks[taskIndex];
      if (task.type === 'pbi' && targetStatus !== 'pbi' && targetStatus !== 'accepted') return prevTasks;
      if (task.type === 'task' && (targetStatus === 'pbi' || targetStatus === 'accepted')) return prevTasks;
      const newTasks = [...prevTasks];
      const updatedTask = { ...task, status: targetStatus };
      if (task.type === 'task' && targetPbiId !== undefined) {
         updatedTask.pbiId = targetPbiId === 'unassigned' ? undefined : targetPbiId;
      }
      newTasks[taskIndex] = updatedTask;
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
    const target = data.tasks.find(t => t.id === id);
    if (target?.type === 'pbi') {
      deletedPbiIds.current.add(id);
      const sprintId = localStorage.getItem('currentSprintId');
      if (sprintId) {
        try { localStorage.setItem(`deleted_pbis_${sprintId}`, JSON.stringify(Array.from(deletedPbiIds.current))); } catch {}
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
      const groupTasks = newTasks.filter(t => t.status === task.status && t.type === task.type && t.pbiId === task.pbiId);
      const groupIndex = groupTasks.findIndex((t) => t.id === id);
      if (direction === -1 && groupIndex > 0) {
        const targetId = groupTasks[groupIndex - 1].id;
        const targetIndex = newTasks.findIndex((t) => t.id === targetId);
        newTasks.splice(index, 1); newTasks.splice(targetIndex, 0, task);
      } else if (direction === 1 && groupIndex < groupTasks.length - 1) {
        const targetId = groupTasks[groupIndex + 1].id;
        const targetIndex = newTasks.findIndex((t) => t.id === targetId);
        newTasks.splice(index, 1); newTasks.splice(targetIndex, 0, task);
      }
      return newTasks;
    });
  };

  const updateTask = (id: string, field: keyof Task, value: string) => {
    setTasks((prev: Task[]) => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // 子任務／附件改走 transaction 逐張任務 patch（與 /my-tasks 相同的寫法），
  // 避免自動存檔把整包 backlog.tasks 覆蓋回去、蓋掉別人剛寫入的子任務或附件。
  // 本機 state 立即更新（setSyncTasks 不標記 dirty）；雲端寫入方面，
  // 子任務因標題／工時是逐字觸發 onChange 而做 800ms 防抖，附件則立即寫出。
  const taskPatchTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingTaskPatch = useRef<Map<string, Partial<Task>>>(new Map());
  const forceSaveRef = useRef(forceSave);
  useEffect(() => { forceSaveRef.current = forceSave; }, [forceSave]);

  const flushTaskPatch = async (taskId: string) => {
    const patch = pendingTaskPatch.current.get(taskId);
    if (!patch) return;
    pendingTaskPatch.current.delete(taskId);
    const sid = localStorage.getItem('currentSprintId') || currentSprintId;
    if (!sid) return;
    try {
      // 先把待存的一般欄位（例如剛新增、尚未寫入雲端的任務）落地，
      // 否則 transaction 在雲端找不到這張任務，patch 會靜默失效
      await forceSaveRef.current();
      await updateTaskInSprint(sid, taskId, patch, {
        email: user?.email ?? null,
        displayName: user?.displayName ?? null,
      });
      // 雲端已是最新，更新存檔基準值，避免下次自動存檔又整包寫回 tasks
      setSyncTasks(prev => prev, { markSaved: true });
    } catch (err) {
      console.error('[Backlog] 子任務／附件寫入失敗，改由自動存檔重試:', err);
      // 保底：改走原本的整包自動存檔路徑，至少不會遺失使用者的編輯
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t));
    }
  };

  // immediate=true 立刻寫出（附件的上傳／刪除是一次性事件，不該被防抖延後，
  // 否則 800ms 內關閉分頁就會遺失，且已上傳的 blob 會變成孤兒檔）
  const scheduleTaskPatch = (taskId: string, patch: Partial<Task>, immediate = false) => {
    const merged = { ...(pendingTaskPatch.current.get(taskId) || {}), ...patch };
    pendingTaskPatch.current.set(taskId, merged);
    const timers = taskPatchTimers.current;
    const existing = timers.get(taskId);
    if (existing) clearTimeout(existing);
    if (immediate) {
      timers.delete(taskId);
      flushTaskPatchRef.current(taskId);
      return;
    }
    timers.set(taskId, setTimeout(() => {
      timers.delete(taskId);
      flushTaskPatchRef.current(taskId);
    }, 800));
  };

  // 補送要用最新的 flushTaskPatch，否則會抓到首次 render 的過期閉包
  const flushTaskPatchRef = useRef(flushTaskPatch);
  flushTaskPatchRef.current = flushTaskPatch;

  const flushAllTaskPatches = () => {
    const timers = taskPatchTimers.current;
    timers.forEach(t => clearTimeout(t));
    timers.clear();
    Array.from(pendingTaskPatch.current.keys()).forEach(id => { flushTaskPatchRef.current(id); });
  };
  const flushAllTaskPatchesRef = useRef(flushAllTaskPatches);
  flushAllTaskPatchesRef.current = flushAllTaskPatches;

  // 關閉分頁／切到背景／換頁時，把還在防抖中的子任務編輯補送出去，
  // 避免最後 800ms 的輸入靜默遺失（子任務走 syncData 不會標記 dirty，
  // 因此 useAutoSave 的草稿備份與 forceSave 都救不到這一段）
  useEffect(() => {
    const handleHide = () => {
      if (document.visibilityState === 'hidden') flushAllTaskPatchesRef.current();
    };
    const handlePageHide = () => { flushAllTaskPatchesRef.current(); };
    document.addEventListener('visibilitychange', handleHide);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleHide);
      window.removeEventListener('pagehide', handlePageHide);
      flushAllTaskPatchesRef.current();
    };
  }, []);

  const patchTask = (taskId: string, patch: Partial<Task>, immediate = false) => {
    if (isViewOnly) return;
    // 未登入（純本機模式）沒有雲端可寫，維持原本的自動存檔路徑
    if (!user) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t));
      return;
    }
    setSyncTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t));
    scheduleTaskPatch(taskId, patch, immediate);
  };

  // 子任務標題／工時是逐字觸發，需要防抖
  const updateSubtasks = (taskId: string, next: Subtask[]) => {
    patchTask(taskId, { subtasks: next });
  };

  // 進度紀錄不能走 patchTask：那會把本機算好的整包 notes 送出去，
  // 兩人同時記錄時後送的一方會吃掉前一則。改用在 transaction 內部
  // 讀出當下 notes 再追加的專用函式。追加／刪除都是一次性動作，不防抖。
  const runNoteOp = async (
    op: 'append' | 'delete',
    taskId: string,
    subtaskId: string | null,
    payload: ProgressNote | string,
    optimistic: (prev: Task[]) => Task[]
  ) => {
    setSyncTasks(optimistic);
    const sid = localStorage.getItem('currentSprintId') || currentSprintId;
    if (!sid) return;
    const actor = { email: user?.email ?? null, displayName: user?.displayName ?? null };
    try {
      // 與 flushTaskPatch 同理：任務可能還沒寫進雲端，先落地否則 transaction 找不到它
      await forceSaveRef.current();
      if (op === 'append') {
        await appendNoteInSprint(sid, taskId, subtaskId, payload as ProgressNote, actor);
      } else {
        await deleteNoteInSprint(sid, taskId, subtaskId, payload as string, actor);
      }
      setSyncTasks(prev => prev, { markSaved: true });
    } catch (err) {
      console.error('[Backlog] 進度紀錄寫入失敗:', err);
      alert('進度紀錄儲存失敗，請重新整理後再試。');
    }
  };

  const noteActor = () => ({ email: user?.email ?? null, displayName: user?.displayName ?? null });

  const appendTaskNote = (taskId: string, text: string, mentions: string[]) => {
    const n = makeNote(text, noteActor(), mentions);
    if (!n) return;
    runNoteOp('append', taskId, null, n, prev =>
      prev.map(t => t.id === taskId ? { ...t, notes: [...(t.notes || []), n] } : t));
  };

  const deleteTaskNote = (taskId: string, noteId: string) => {
    runNoteOp('delete', taskId, null, noteId, prev =>
      prev.map(t => t.id === taskId ? { ...t, notes: (t.notes || []).filter(x => x.id !== noteId) } : t));
  };

  const appendSubtaskNote = (taskId: string, subtaskId: string, text: string, mentions: string[]) => {
    const n = makeNote(text, noteActor(), mentions);
    if (!n) return;
    runNoteOp('append', taskId, subtaskId, n, prev =>
      prev.map(t => t.id !== taskId ? t : ({
        ...t,
        subtasks: (t.subtasks || []).map(sub => sub.id !== subtaskId
          ? sub : { ...sub, notes: [...(sub.notes || []), n] }),
      })));
  };

  const deleteSubtaskNote = (taskId: string, subtaskId: string, noteId: string) => {
    runNoteOp('delete', taskId, subtaskId, noteId, prev =>
      prev.map(t => t.id !== taskId ? t : ({
        ...t,
        subtasks: (t.subtasks || []).map(sub => sub.id !== subtaskId
          ? sub : { ...sub, notes: (sub.notes || []).filter(x => x.id !== noteId) }),
      })));
  };

  // 附件的新增／刪除是一次性事件，立即寫出
  const updateAttachments = (taskId: string, next: Attachment[]) => {
    patchTask(taskId, { attachments: next }, true);
  };

  // 子任務全數完成時詢問是否把父任務標為完成。
  // 使用者按取消後，同一張任務在本次瀏覽階段不再重複詢問。
  const askedAllDoneRef = useRef<Set<string>>(new Set());
  const handleAllSubtasksDone = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === 'done' || task.status === 'accepted') return;
    if (askedAllDoneRef.current.has(taskId)) return;
    askedAllDoneRef.current.add(taskId);
    setTimeout(() => {
      if (window.confirm('全部子任務已完成，要把這張任務標為完成嗎？')) {
        updateTask(taskId, 'status', 'done');
      }
    }, 0);
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
          <div className="flex items-center justify-center h-full text-[#8B887E] text-xs border border-dashed border-[#D8D3C5] rounded-xl m-2 bg-[#FAF9F5] min-h-[150px]">
            <span>{status === 'accepted' ? '拖曳任務至此' : '尚無項目'}</span>
          </div>
        );
      } else {
        return (
          <div
             className="flex items-center justify-center h-full text-[#B5B2A6] text-xs border border-dashed border-[#E9E5DA] rounded-lg m-2 min-h-[80px]"
             onDragOver={onDragOver}
             onDrop={(e) => { e.stopPropagation(); onDrop(e, status, undefined, pbiId); }}
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
          onDrop={(e) => { e.stopPropagation(); onDrop(e, status, task.id, pbiId); }}
          style={task.color ? { borderLeftColor: task.color, borderLeftWidth: '3px', borderLeftStyle: 'solid' } : undefined}
          className={`bg-white p-3 rounded-xl transition-all duration-150 group relative
            ${task.type === 'pbi'
              ? 'border border-[#E9E5DA] border-l-[3px] border-l-[#C96442]'
              : task.status === 'doing'
                ? 'border border-[#E9E5DA] border-l-[3px] border-l-[#C96442]'
                : 'border border-[#E9E5DA]'
            }
            ${!isEditing ? 'cursor-grab active:cursor-grabbing hover:shadow-sm hover:-translate-y-[1px]' : 'shadow-sm'}
          `}
        >
          <div className="flex justify-between items-start mb-2">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded
              ${task.type === 'pbi' ? 'bg-[#F5E4DA] text-[#7A3520]' : 'bg-[#F6F3EB] text-[#8B887E]'}`}
            >
              {task.type === 'pbi' ? 'PBI' : '任務'}
            </span>
            {!isEditing && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 absolute top-2 right-2 bg-white/90 border border-[#E9E5DA] p-0.5 rounded-lg shadow-sm z-10">
                <button onClick={() => moveTask(task.id, -1)} className="text-[#8B887E] hover:text-[#1F1D17] hover:bg-[#F1EEE6] p-1.5 rounded-md transition-all" title="向上排序"><ChevronUp size={13} strokeWidth={1.75} /></button>
                <button onClick={() => moveTask(task.id, 1)} className="text-[#8B887E] hover:text-[#1F1D17] hover:bg-[#F1EEE6] p-1.5 rounded-md transition-all" title="向下排序"><ChevronDown size={13} strokeWidth={1.75} /></button>
                <button onClick={() => copyTask(task.id)} className="text-[#8B887E] hover:text-[#4F7E5C] hover:bg-[#F1EEE6] p-1.5 rounded-md transition-all" title="複製"><Copy size={13} strokeWidth={1.75} /></button>
                <button onClick={(e) => { e.stopPropagation(); setColorPickerTaskId(colorPickerTaskId === task.id ? null : task.id); }} className="text-[#8B887E] hover:text-[#C96442] hover:bg-[#F1EEE6] p-1.5 rounded-md transition-all" title="顏色"><Palette size={13} strokeWidth={1.75} /></button>
                <button onClick={() => setEditingTaskId(task.id)} className="text-[#8B887E] hover:text-[#1F1D17] hover:bg-[#F1EEE6] p-1.5 rounded-md transition-all" title="編輯"><Pencil size={13} strokeWidth={1.75} /></button>
                <button onClick={() => deleteTask(task.id)} className="text-[#8B887E] hover:text-[#B8543C] hover:bg-[#F0DDD3] p-1.5 rounded-md transition-all" title="刪除"><Trash2 size={13} strokeWidth={1.75} /></button>
              </div>
            )}
            {colorPickerTaskId === task.id && (
              <div className="absolute top-9 right-2 z-30 bg-white border border-[#E9E5DA] rounded-lg shadow-md p-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()} draggable onDragStart={(e) => e.preventDefault()}>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#5A574E]">
                  <input type="color" value={task.color || '#C96442'} onChange={(e) => updateTask(task.id, 'color', e.target.value)} className="w-7 h-7 p-0 border border-[#E9E5DA] rounded cursor-pointer bg-white" title="選擇顏色" />
                  選色
                </label>
                <button onClick={() => { updateTask(task.id, 'color', ''); setColorPickerTaskId(null); }} className="text-xs text-[#8B887E] hover:text-[#B8543C] px-2 py-1 rounded hover:bg-[#F0DDD3] transition-all whitespace-nowrap">清除</button>
                <button onClick={() => setColorPickerTaskId(null)} className="text-[#8B887E] hover:text-[#1F1D17] p-1 rounded hover:bg-[#F1EEE6] transition-all" title="關閉"><X size={12} strokeWidth={1.75} /></button>
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-2 mt-2">
              <input
                type="text" value={task.title}
                onChange={(e) => updateTask(task.id, 'title', e.target.value)}
                className="w-full text-sm font-semibold p-2 border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA]"
                placeholder={task.type === 'pbi' ? "PBI 標題" : "任務標題"}
              />
              <textarea
                value={task.desc || ''} onChange={(e) => updateTask(task.id, 'desc', e.target.value)}
                className="w-full text-xs p-2 border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA]"
                placeholder={task.type === 'pbi' ? "PBI 描述說明 (選填)" : "任務詳細說明 (選填)"}
                rows={3}
              />
              {task.type === 'task' && (
                <>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input type="text" value={task.role || ''} onChange={(e) => updateTask(task.id, 'role', e.target.value)}
                        className="w-1/2 text-xs p-2 border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA]" placeholder="負責人 (可多選)" />
                      <input type="text" value={task.time || ''} onChange={(e) => updateTask(task.id, 'time', e.target.value)}
                        className="w-1/2 text-xs p-2 border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA]" placeholder="預估工時 (例: 4h)" />
                    </div>
                    {data.devsList && data.devsList.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {data.devsList.map((dev: string) => {
                          const currentRoles = (task.role || '').split(',').map((r: string) => r.trim()).filter((r: string) => r);
                          const isSelected = currentRoles.includes(dev);
                          return (
                            <button key={dev} type="button"
                              onClick={() => {
                                if (isSelected) {
                                  updateTask(task.id, 'role', currentRoles.filter((r: string) => r !== dev).join(', '));
                                } else {
                                  updateTask(task.id, 'role', [...currentRoles, dev].join(', '));
                                }
                              }}
                              className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                                isSelected
                                  ? 'bg-[#C96442] text-white border-[#C96442]'
                                  : 'bg-[#F6F3EB] text-[#5A574E] border-[#E9E5DA] hover:border-[#C96442] hover:text-[#C96442]'
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
                    <select value={task.pbiId || ''} onChange={(e) => updateTask(task.id, 'pbiId', e.target.value)}
                      className="w-full text-xs p-2 border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] bg-white text-[#5A574E]">
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
                    if (!task.title.trim()) updateTask(task.id, 'title', '未命名項目');
                    setEditingTaskId(null);
                    setTimeout(() => forceSave && forceSave(), 50);
                  }}
                  className="flex-1 bg-[#1F1D17] text-white text-xs font-semibold py-2 rounded-lg hover:bg-[#5A574E] transition-colors"
                >
                  確認張貼
                </button>
                <button
                  onClick={() => { if (!task.title.trim()) deleteTask(task.id); setEditingTaskId(null); }}
                  className="border border-[#B8543C] text-[#B8543C] text-xs px-3 py-2 rounded-lg hover:bg-[#F0DDD3] transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="font-semibold text-sm text-[#1F1D17] mb-1.5 leading-tight pr-6 break-all">{task.title}</div>
              {task.desc && <div className="text-xs text-[#5A574E] leading-relaxed mb-2 break-words whitespace-pre-wrap">{task.desc}</div>}
              {(task.role || task.time) && (
                <div className="mt-auto pt-2 flex items-center justify-between border-t border-[#E9E5DA]">
                  {task.role && <div className="text-[11px] text-[#5A574E] bg-[#F6F3EB] px-1.5 py-0.5 rounded">{task.role}</div>}
                  {task.time && <div className="text-xs text-[#8B887E]">{task.time}</div>}
                </div>
              )}
              {task.type === 'task' && (
                <div onDragStart={e => e.stopPropagation()} draggable={false}>
                  <SubtaskList
                    subtasks={task.subtasks || []}
                    roleNames={parseRoleNames(task.role)}
                    devMembers={data.devMembers || []}
                    sprint={{ ownerId: sprintOwnerId }}
                    planning={data.planning}
                    user={user}
                    sprintId={currentSprintId}
                    currentUserEmail={user?.email || ''}
                    readOnly={isViewOnly}
                    onChange={next => updateSubtasks(task.id, next)}
                    onAllDone={() => handleAllSubtasksDone(task.id)}
                    canDeleteAnyNote={canDeleteAnyNote}
                    onAppendNote={(subId, text, mentions) => appendSubtaskNote(task.id, subId, text, mentions)}
                    onDeleteNote={(subId, noteId) => deleteSubtaskNote(task.id, subId, noteId)}
                  />
                </div>
              )}
              <div onDragStart={e => e.stopPropagation()} draggable={false}>
                <AttachmentBox
                  attachments={task.attachments || []}
                  sprintId={currentSprintId}
                  uploadedBy={user?.email || ''}
                  readOnly={isViewOnly}
                  onChange={next => updateAttachments(task.id, next)}
                />
                <ProgressLog
                  notes={task.notes || []}
                  currentUserEmail={user?.email || ''}
                  readOnly={isViewOnly}
                  devMembers={data.devMembers || []}
                  canDeleteAny={canDeleteAnyNote}
                  onAppend={(text, mentions) => appendTaskNote(task.id, text, mentions)}
                  onDelete={noteId => deleteTaskNote(task.id, noteId)}
                />
              </div>
            </>
          )}
        </div>
      );
    });
  };

  return (
    <main className="min-h-screen bg-[#FAF9F5] p-4 md:p-8 font-sans text-[#1F1D17]">
      <div className="w-full space-y-6">

        <div className="flex flex-col items-center">
          <Navigation />
          <SaveIndicator status={saveStatus} />
          <div className="text-sm text-[#8B887E] mt-1" suppressHydrationWarning>{dateLabel}</div>
        </div>

        {loading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
            <div className="bg-white px-6 py-4 rounded-xl border border-[#E9E5DA] text-[#5A574E] shadow-xl text-sm flex items-center gap-3">
              <Save size={15} strokeWidth={1.75} className="text-[#8B887E]" />
              <span>載入資料中...</span>
            </div>
          </div>
        )}

        {/* Sprint 核心資訊 */}
        <section className="bg-white border border-[#E9E5DA] rounded-xl overflow-hidden">
          <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-5 py-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#C96442] flex items-center justify-center flex-shrink-0">
              <Target size={13} strokeWidth={2} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-[#1F1D17]">Sprint 核心資訊</span>
          </div>
          <div className="p-5 flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-1 flex flex-col gap-2">
              <label className="text-sm font-medium text-[#5A574E] flex items-center gap-1.5">
                <Target size={14} strokeWidth={1.75} className="text-[#8B887E]" />
                Sprint Goal（目標）
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 bg-[#FAF9F5] border border-[#D8D3C5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] text-[#1F1D17] text-sm placeholder:text-[#B5B2A6]"
                placeholder="輸入本期主要目標..."
                value={data.sprintGoal}
                onChange={e => updateData({ sprintGoal: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2 relative md:w-44">
              <label className="text-sm font-medium text-[#5A574E]">週期（天）</label>
              {/* 唯讀：以 Sprint Planning 的時間限制為單一來源，避免兩頁天數不一致 */}
              <div
                className="w-full px-3 py-3 bg-[#F6F3EB] border border-[#E9E5DA] rounded-lg text-sm text-[#1F1D17]"
                title="週期天數由 Sprint Planning 的時間限制決定，請至 Sprint Planning 調整"
              >
                {sprintDays || '—'}
              </div>
              <div className="text-[11px] text-[#8B887E] leading-snug">
                來自 Sprint Planning{planningTimeLabel ? `：${planningTimeLabel}` : ''}
              </div>
              {(() => {
                if (!sprintStartDate) return null;
                const today = new Date(); today.setHours(0,0,0,0);
                const start = new Date(sprintStartDate); start.setHours(0,0,0,0);
                const total = Number(sprintDays) || 0;
                const hdSet = new Set(holidays.map(h => h.date));
                const countWD = (from: Date, to: Date) => {
                  let n = 0; const c = new Date(from);
                  while (c <= to) { const d = c.getDay(); const iso = c.toISOString().slice(0,10); if (d!==0&&d!==6&&!hdSet.has(iso)) n++; c.setDate(c.getDate()+1); }
                  return n;
                };
                const sprintEnd = new Date(start); sprintEnd.setDate(sprintEnd.getDate() + total - 1);
                const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
                const elapsed = countWD(start, today);
                const isOverdue = today > sprintEnd;
                const remaining = isOverdue ? 0 : countWD(tomorrow, sprintEnd);
                return (
                  <div className={`mt-1 rounded-lg px-3 py-2 text-xs text-center ${
                    isOverdue ? 'bg-[#F0DDD3] text-[#B8543C]'
                    : remaining <= 3 ? 'bg-[#F0E4C9] text-[#B8893A]'
                    : 'bg-[#DDE6D9] text-[#4F7E5C]'
                  }`}>
                    {isOverdue
                      ? `已超出 Sprint 期限`
                      : <>第 {elapsed} 工作天 / 共 {total} 天<br/><span className="text-sm font-bold">還剩 {remaining} 工作天</span></>
                    }
                  </div>
                );
              })()}
            </div>
          </div>
        </section>

        {/* 完成進度 */}
        {(() => {
          const pbis = tasks.filter(t => t.status === 'pbi');
          const pbiIdSet = new Set(pbis.map(t => t.id));
          const allTasks = tasks.filter(t => t.type === 'task' && t.pbiId && pbiIdSet.has(t.pbiId));
          if (allTasks.length === 0 && pbis.length === 0) return null;
          const todo = allTasks.filter(t => t.status === 'todo').length;
          const doing = allTasks.filter(t => t.status === 'doing').length;
          const done = allTasks.filter(t => t.status === 'done').length;
          const total = allTasks.length;
          const pct = (n: number) => total > 0 ? Math.round(n / total * 100) : 0;
          return (
            <section className="bg-white border border-[#E9E5DA] rounded-xl overflow-hidden">
              <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-5 py-3 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#4F7E5C] flex items-center justify-center flex-shrink-0">
                  <BarChart2 size={13} strokeWidth={2} className="text-white" />
                </div>
                <span className="text-sm font-semibold text-[#1F1D17]">任務完成進度</span>
              </div>
              <div className="p-4 md:p-5 space-y-5">

                {total > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-end justify-between">
                      <div className="text-sm text-[#5A574E]">整體完成率</div>
                      <div className="text-3xl font-bold text-[#1F1D17]">{pct(done)}%</div>
                    </div>
                    <div className="w-full h-[7px] rounded-full bg-[#F1EEE6] overflow-hidden flex">
                      {done > 0 && <div style={{ width: `${pct(done)}%` }} className="bg-[#4F7E5C] h-full transition-all duration-500" />}
                      {doing > 0 && <div style={{ width: `${pct(doing)}%` }} className="bg-[#C96442] h-full transition-all duration-500" />}
                      {todo > 0 && <div style={{ width: `${pct(todo)}%` }} className="bg-[#E9E5DA] h-full transition-all duration-500" />}
                    </div>
                    <div className="flex gap-3 text-xs text-[#8B887E]">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#4F7E5C] inline-block" />完成</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#C96442] inline-block" />進行中</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#E9E5DA] inline-block" />待處理</span>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-[#E9E5DA] border border-[#E9E5DA] rounded-xl overflow-hidden">
                      <div className="p-3 text-center">
                        <div className="text-2xl font-bold text-[#4F7E5C]">{done}</div>
                        <div className="text-xs text-[#8B887E] mt-0.5">完成</div>
                        <div className="text-[10px] text-[#B5B2A6]">{pct(done)}%</div>
                      </div>
                      <div className="p-3 text-center">
                        <div className="text-2xl font-bold text-[#B8893A]">{doing}</div>
                        <div className="text-xs text-[#8B887E] mt-0.5">進行中</div>
                        <div className="text-[10px] text-[#B5B2A6]">{pct(doing)}%</div>
                      </div>
                      <div className="p-3 text-center">
                        <div className="text-2xl font-bold text-[#8B887E]">{todo}</div>
                        <div className="text-xs text-[#8B887E] mt-0.5">待處理</div>
                        <div className="text-[10px] text-[#B5B2A6]">{pct(todo)}%</div>
                      </div>
                    </div>
                    <div className="text-xs text-[#8B887E] text-right">共 {total} 個任務</div>
                  </div>
                )}

                {pbis.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-[#5A574E] border-b border-[#E9E5DA] pb-2">PBI 逐項進度</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[380px]">
                        <thead>
                          <tr className="border-b border-[#E9E5DA]">
                            <th className="text-left py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#8B887E]">PBI 項目</th>
                            <th className="text-center py-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-[#B8543C] w-14">待</th>
                            <th className="text-center py-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-[#B8893A] w-14">行</th>
                            <th className="text-center py-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-[#4F7E5C] w-14">完</th>
                            <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#8B887E]">進度</th>
                            <th className="text-center py-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-[#8B887E] w-12">驗收</th>
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
                              <tr key={pbi.id} className="border-b border-[#E9E5DA] hover:bg-[#FAF9F5] transition-colors">
                                <td className="py-2.5 px-3 max-w-[140px] md:max-w-[220px]">
                                  <div className="font-medium text-[#1F1D17] text-xs leading-tight truncate" title={pbi.title}>{pbi.title || '(未命名)'}</div>
                                </td>
                                <td className="text-center py-2.5 px-2">
                                  <span className={`text-sm font-medium ${pt_todo > 0 ? 'text-[#B8543C]' : 'text-[#B5B2A6]'}`}>{pt_todo}</span>
                                </td>
                                <td className="text-center py-2.5 px-2">
                                  <span className={`text-sm font-medium ${pt_doing > 0 ? 'text-[#B8893A]' : 'text-[#B5B2A6]'}`}>{pt_doing}</span>
                                </td>
                                <td className="text-center py-2.5 px-2">
                                  <span className={`text-sm font-medium ${pt_done > 0 ? 'text-[#4F7E5C]' : 'text-[#B5B2A6]'}`}>{pt_done}</span>
                                </td>
                                <td className="py-2.5 px-3">
                                  {pt_total > 0 ? (
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-[5px] rounded-full bg-[#F1EEE6] overflow-hidden flex">
                                        {pt_done > 0 && <div style={{ width: `${pt_pct}%` }} className="bg-[#4F7E5C] h-full" />}
                                        {pt_doing > 0 && <div style={{ width: `${pt_doing_pct}%` }} className="bg-[#C96442] h-full" />}
                                      </div>
                                      <span className="text-xs text-[#5A574E] w-8 text-right shrink-0">{pt_pct}%</span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-[#B5B2A6]">尚無任務</span>
                                  )}
                                </td>
                                <td className="text-center py-2.5 px-2">
                                  {pbi.acceptedBy
                                    ? <span title={`${pbi.acceptedBy} ${pbi.acceptedAt}`}><CheckCircle2 size={14} strokeWidth={1.75} className="text-[#4F7E5C] inline-block" /></span>
                                    : <span className="text-[#B5B2A6] text-xs">○</span>
                                  }
                                </td>
                              </tr>
                            );
                          })}
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
                              <tr className="border-b border-[#E9E5DA] bg-[#FAF9F5]">
                                <td className="py-2.5 px-3"><div className="text-xs text-[#8B887E] italic">無歸屬任務</div></td>
                                <td className="text-center py-2.5 px-2"><span className={`text-sm font-medium ${ut_todo > 0 ? 'text-[#B8543C]' : 'text-[#B5B2A6]'}`}>{ut_todo}</span></td>
                                <td className="text-center py-2.5 px-2"><span className={`text-sm font-medium ${ut_doing > 0 ? 'text-[#B8893A]' : 'text-[#B5B2A6]'}`}>{ut_doing}</span></td>
                                <td className="text-center py-2.5 px-2"><span className={`text-sm font-medium ${ut_done > 0 ? 'text-[#4F7E5C]' : 'text-[#B5B2A6]'}`}>{ut_done}</span></td>
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-[5px] rounded-full bg-[#F1EEE6] overflow-hidden flex">
                                      {ut_done > 0 && <div style={{ width: `${ut_pct}%` }} className="bg-[#4F7E5C] h-full" />}
                                      {ut_doing > 0 && <div style={{ width: `${ut_doing_pct}%` }} className="bg-[#C96442] h-full" />}
                                    </div>
                                    <span className="text-xs text-[#5A574E] w-8 text-right shrink-0">{ut_pct}%</span>
                                  </div>
                                </td>
                                <td className="text-center py-2.5 px-2"><span className="text-[#B5B2A6]">—</span></td>
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
        <section className="md:hidden bg-white border border-[#E9E5DA] rounded-xl overflow-hidden">
          <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-4 py-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-[#C96442] flex items-center justify-center flex-shrink-0">
                <Kanban size={13} strokeWidth={2} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-[#1F1D17]">任務看板</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => fileInputRef.current?.click()} disabled={isPhotoRestoring}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#E9E5DA] bg-white text-[#5A574E] rounded-lg disabled:opacity-50 transition-all hover:shadow-sm">
                <Camera size={12} strokeWidth={1.75} />
                {isPhotoRestoring ? 'AI 解析中...' : '從照片還原'}
              </button>
              <button
                onClick={() => { const newId = `pbi-${Date.now()}`; setTasks([{ id: newId, type: 'pbi', status: 'pbi', title: '', desc: '', role: '', time: '' }, ...tasks]); setEditingTaskId(newId); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#E9E5DA] bg-white text-[#C96442] rounded-lg transition-all hover:shadow-sm hover:border-[#C96442]">
                <Layers size={12} strokeWidth={1.75} />
                新增 PBI
              </button>
              <button
                onClick={() => { const newId = `task-${Date.now()}`; setTasks([{ id: newId, type: 'task', status: 'todo', title: '', desc: '', role: '', time: '' }, ...tasks]); setEditingTaskId(newId); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#E9E5DA] bg-white text-[#5A574E] rounded-lg transition-all hover:shadow-sm">
                <Plus size={12} strokeWidth={1.75} />
                新增任務
              </button>
            </div>
          </div>

          {/* 狀態篩選 segmented control */}
          <div className="px-3 py-2 bg-white border-b border-[#E9E5DA]">
            <div className="flex p-1 bg-[#F1EEE6] rounded-lg gap-0.5">
              {([
                { key: 'all', label: '全部', color: '#1F1D17' },
                { key: 'todo', label: 'TO DO', color: '#B8543C' },
                { key: 'doing', label: '進行中', color: '#B8893A' },
                { key: 'done', label: '完成', color: '#4F7E5C' },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setMobileStatusFilter(tab.key)}
                  style={mobileStatusFilter === tab.key ? { color: tab.color } : {}}
                  className={`flex-1 py-1.5 text-xs rounded-md transition-all ${
                    mobileStatusFilter === tab.key ? 'bg-white font-semibold shadow-sm' : 'text-[#8B887E]'
                  }`}
                >{tab.label}</button>
              ))}
            </div>
          </div>

          <div className="p-3 space-y-3">
            {tasks.filter(t => t.status === 'pbi').map(pbi => {
              const pbiTasks = tasks.filter(t => t.type === 'task' && t.pbiId === pbi.id);
              const filtered = mobileStatusFilter === 'all' ? pbiTasks : pbiTasks.filter(t => t.status === mobileStatusFilter);
              if (mobileStatusFilter !== 'all' && filtered.length === 0) return null;
              const isEditingPbi = editingTaskId === pbi.id;
              return (
                <div key={pbi.id} className="border border-[#E9E5DA] border-l-[3px] border-l-[#C96442] rounded-xl overflow-hidden">
                  <div className="bg-[#F6F3EB] p-3">
                    {isEditingPbi ? (
                      <div className="space-y-2">
                        <input type="text" value={pbi.title} onChange={e => updateTask(pbi.id, 'title', e.target.value)}
                          className="w-full text-sm font-semibold p-2 border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA]" placeholder="PBI 標題" />
                        <textarea value={pbi.desc || ''} onChange={e => updateTask(pbi.id, 'desc', e.target.value)}
                          className="w-full text-xs p-2 border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA]" rows={2} placeholder="PBI 描述說明 (選填)" />
                        <button onClick={() => { setEditingTaskId(null); setTimeout(() => forceSave && forceSave(), 50); }}
                          className="w-full bg-[#1F1D17] text-white text-xs font-semibold py-2 rounded-lg hover:bg-[#5A574E] transition-colors">完成</button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F5E4DA] text-[#7A3520]">PBI</span>
                          <div className="font-semibold text-sm text-[#1F1D17] mt-1 break-words">{pbi.title || '(未命名)'}</div>
                          {pbi.desc && <div className="text-xs text-[#5A574E] mt-0.5 break-words">{pbi.desc}</div>}
                          <AttachmentBox
                            attachments={pbi.attachments || []}
                            sprintId={currentSprintId}
                            uploadedBy={user?.email || ''}
                            readOnly={isViewOnly}
                            onChange={next => updateAttachments(pbi.id, next)}
                          />
                          <ProgressLog
                            notes={pbi.notes || []}
                            currentUserEmail={user?.email || ''}
                            readOnly={isViewOnly}
                            devMembers={data.devMembers || []}
                            canDeleteAny={canDeleteAnyNote}
                            onAppend={(text, mentions) => appendTaskNote(pbi.id, text, mentions)}
                            onDelete={noteId => deleteTaskNote(pbi.id, noteId)}
                          />
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => handleAiGenerateTasks(pbi.id, pbi.title)} disabled={isAiLoading}
                            className="text-[#8B887E] hover:text-[#5A574E] hover:bg-[#F1EEE6] p-1.5 rounded-md transition-all disabled:opacity-40" title="AI拆解">
                            <Bot size={14} strokeWidth={1.75} />
                          </button>
                          <button onClick={() => copyTask(pbi.id)} className="text-[#8B887E] hover:text-[#4F7E5C] hover:bg-[#F1EEE6] p-1.5 rounded-md transition-all" title="複製">
                            <Copy size={14} strokeWidth={1.75} />
                          </button>
                          <button onClick={() => setEditingTaskId(pbi.id)} className="text-[#8B887E] hover:text-[#1F1D17] hover:bg-[#F1EEE6] p-1.5 rounded-md transition-all" title="編輯">
                            <Pencil size={14} strokeWidth={1.75} />
                          </button>
                          <button onClick={() => deleteTask(pbi.id)} className="text-[#8B887E] hover:text-[#B8543C] hover:bg-[#F0DDD3] p-1.5 rounded-md transition-all" title="刪除">
                            <Trash2 size={14} strokeWidth={1.75} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-2 space-y-2 bg-white">
                    <button
                      onClick={() => { const newId = `task-${Date.now()}`; setTasks(prev => [{ id: newId, type: 'task', status: 'todo', title: '', desc: '', role: '', time: '', pbiId: pbi.id }, ...prev]); setEditingTaskId(newId); }}
                      className="w-full flex items-center justify-center gap-1 text-xs border border-[#C96442] text-[#C96442] px-3 py-1.5 rounded-lg hover:bg-[#F5E4DA] transition-all">
                      <Plus size={12} strokeWidth={1.75} /> 建立任務
                    </button>
                    {filtered.length === 0 ? (
                      <div className="text-center text-xs text-[#B5B2A6] py-2">此 PBI 尚無任務</div>
                    ) : filtered.map(task => {
                      const isEditing = editingTaskId === task.id;
                      const sC: Record<string,string> = {
                        todo: 'bg-[#F0DDD3] text-[#B8543C]',
                        doing: 'bg-[#F0E4C9] text-[#B8893A]',
                        done: 'bg-[#DDE6D9] text-[#4F7E5C]'
                      };
                      const sL: Record<string,string> = { todo:'TO DO', doing:'進行中', done:'完成' };
                      return (
                        <div key={task.id} className={`border border-[#E9E5DA] rounded-xl p-3 bg-white ${task.status === 'doing' ? 'border-l-[3px] border-l-[#C96442]' : ''}`}>
                          {isEditing ? (
                            <div className="space-y-2">
                              <input type="text" value={task.title} onChange={e => updateTask(task.id,'title',e.target.value)}
                                className="w-full text-sm font-semibold p-2 border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA]" placeholder="任務標題" />
                              <textarea value={task.desc||''} onChange={e => updateTask(task.id,'desc',e.target.value)}
                                className="w-full text-xs p-2 border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA]" rows={2} placeholder="任務說明 (選填)" />
                              <div className="flex gap-2">
                                <input type="text" value={task.role||''} onChange={e => updateTask(task.id,'role',e.target.value)}
                                  className="flex-1 text-xs p-2 border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA]" placeholder="負責人" />
                                <input type="text" value={task.time||''} onChange={e => updateTask(task.id,'time',e.target.value)}
                                  className="flex-1 text-xs p-2 border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA]" placeholder="工時" />
                              </div>
                              {data.devsList && data.devsList.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {data.devsList.map((dev:string) => {
                                    const cur=(task.role||'').split(',').map((r:string)=>r.trim()).filter((r:string)=>r);
                                    const sel=cur.includes(dev);
                                    return <button key={dev} type="button"
                                      onClick={()=>updateTask(task.id,'role',sel?cur.filter((r:string)=>r!==dev).join(', '):[...cur,dev].join(', '))}
                                      className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${sel?'bg-[#C96442] text-white border-[#C96442]':'bg-[#F6F3EB] text-[#5A574E] border-[#E9E5DA]'}`}>
                                      {dev} {sel?'✓':'+'}
                                    </button>;
                                  })}
                                </div>
                              )}
                              <select value={task.status} onChange={e => updateTask(task.id,'status',e.target.value)}
                                className="w-full text-xs p-2 border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] bg-white text-[#5A574E]">
                                <option value="todo">TO DO（待處理）</option>
                                <option value="doing">進行中</option>
                                <option value="done">已完成</option>
                              </select>
                              <div className="flex gap-2">
                                <button onClick={()=>{if(!task.title.trim())updateTask(task.id,'title','未命名項目');setEditingTaskId(null);setTimeout(()=>forceSave&&forceSave(),50);}}
                                  className="flex-1 bg-[#1F1D17] text-white text-xs font-semibold py-2 rounded-lg hover:bg-[#5A574E] transition-colors">確認張貼</button>
                                <button onClick={()=>{if(!task.title.trim())deleteTask(task.id);setEditingTaskId(null);}}
                                  className="border border-[#B8543C] text-[#B8543C] text-xs px-3 py-2 rounded-lg hover:bg-[#F0DDD3] transition-colors">取消</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-sm text-[#1F1D17] break-words">{task.title}</div>
                                  {task.desc && <div className="text-xs text-[#5A574E] mt-0.5 break-words whitespace-pre-wrap">{task.desc}</div>}
                                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${sC[task.status]}`}>{sL[task.status]}</span>
                                    {task.role && <span className="text-[10px] text-[#5A574E] bg-[#F6F3EB] px-1.5 py-0.5 rounded">{task.role}</span>}
                                    {task.time && <span className="text-[10px] text-[#8B887E]">{task.time}</span>}
                                  </div>
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                  <button onClick={()=>copyTask(task.id)} className="text-[#8B887E] hover:text-[#4F7E5C] hover:bg-[#F1EEE6] p-1.5 rounded-md transition-all" title="複製"><Copy size={13} strokeWidth={1.75} /></button>
                                  <button onClick={()=>setEditingTaskId(task.id)} className="text-[#8B887E] hover:text-[#1F1D17] hover:bg-[#F1EEE6] p-1.5 rounded-md transition-all" title="編輯"><Pencil size={13} strokeWidth={1.75} /></button>
                                  <button onClick={()=>deleteTask(task.id)} className="text-[#8B887E] hover:text-[#B8543C] hover:bg-[#F0DDD3] p-1.5 rounded-md transition-all" title="刪除"><Trash2 size={13} strokeWidth={1.75} /></button>
                                </div>
                              </div>
                              <SubtaskList
                                subtasks={task.subtasks || []}
                                roleNames={parseRoleNames(task.role)}
                                devMembers={data.devMembers || []}
                                sprint={{ ownerId: sprintOwnerId }}
                                planning={data.planning}
                                user={user}
                                sprintId={currentSprintId}
                                currentUserEmail={user?.email || ''}
                                readOnly={isViewOnly}
                                onChange={next => updateSubtasks(task.id, next)}
                                onAllDone={() => handleAllSubtasksDone(task.id)}
                                canDeleteAnyNote={canDeleteAnyNote}
                                onAppendNote={(subId, text, mentions) => appendSubtaskNote(task.id, subId, text, mentions)}
                                onDeleteNote={(subId, noteId) => deleteSubtaskNote(task.id, subId, noteId)}
                              />
                              <AttachmentBox
                                attachments={task.attachments || []}
                                sprintId={currentSprintId}
                                uploadedBy={user?.email || ''}
                                readOnly={isViewOnly}
                                onChange={next => updateAttachments(task.id, next)}
                              />
                              <ProgressLog
                                notes={task.notes || []}
                                currentUserEmail={user?.email || ''}
                                readOnly={isViewOnly}
                                devMembers={data.devMembers || []}
                                canDeleteAny={canDeleteAnyNote}
                                onAppend={(text, mentions) => appendTaskNote(task.id, text, mentions)}
                                onDelete={noteId => deleteTaskNote(task.id, noteId)}
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {pbi.acceptedBy ? (
                    <div className="bg-[#DDE6D9] border-t border-[#E9E5DA] p-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-[#4F7E5C] font-medium">
                        <CheckCircle2 size={13} strokeWidth={1.75} />
                        已驗收：{pbi.acceptedBy}（{pbi.acceptedAt}）
                      </div>
                      <button onClick={()=>cancelAcceptPbi(pbi.id)} className="text-[10px] text-[#5A574E] underline ml-2">取消驗收</button>
                    </div>
                  ) : poName ? (
                    <div className="border-t border-[#E9E5DA] p-2">
                      <button onClick={()=>acceptPbi(pbi.id)}
                        className="w-full flex items-center justify-center gap-1.5 bg-[#1F1D17] text-white text-xs font-semibold py-2 rounded-lg hover:bg-[#5A574E] transition-colors">
                        <CheckCircle2 size={13} strokeWidth={1.75} />
                        驗收確認
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {(() => {
              const unassigned = tasks.filter(t => t.type === 'task' && !t.pbiId);
              const filtered = mobileStatusFilter === 'all' ? unassigned : unassigned.filter(t => t.status === mobileStatusFilter);
              if (filtered.length === 0) return null;
              return (
                <div className="border border-[#E9E5DA] rounded-xl overflow-hidden">
                  <div className="bg-[#F6F3EB] p-3 text-xs font-medium text-[#8B887E]">無歸屬任務</div>
                  <div className="p-2 space-y-2 bg-white">
                    {filtered.map(task => {
                      const isEditing = editingTaskId === task.id;
                      const sC: Record<string,string> = {
                        todo: 'bg-[#F0DDD3] text-[#B8543C]',
                        doing: 'bg-[#F0E4C9] text-[#B8893A]',
                        done: 'bg-[#DDE6D9] text-[#4F7E5C]'
                      };
                      const sL: Record<string,string> = { todo:'TO DO', doing:'進行中', done:'完成' };
                      return (
                        <div key={task.id} className={`border border-[#E9E5DA] rounded-xl p-3 bg-white ${task.status === 'doing' ? 'border-l-[3px] border-l-[#C96442]' : ''}`}>
                          {isEditing ? (
                            <div className="space-y-2">
                              <input type="text" value={task.title} onChange={e=>updateTask(task.id,'title',e.target.value)}
                                className="w-full text-sm font-semibold p-2 border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA]" placeholder="任務標題" />
                              <textarea value={task.desc||''} onChange={e=>updateTask(task.id,'desc',e.target.value)}
                                className="w-full text-xs p-2 border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA]" rows={2} placeholder="任務說明 (選填)" />
                              <div className="flex gap-2">
                                <input type="text" value={task.role||''} onChange={e=>updateTask(task.id,'role',e.target.value)}
                                  className="flex-1 text-xs p-2 border border-[#E9E5DA] rounded-lg" placeholder="負責人" />
                                <input type="text" value={task.time||''} onChange={e=>updateTask(task.id,'time',e.target.value)}
                                  className="flex-1 text-xs p-2 border border-[#E9E5DA] rounded-lg" placeholder="工時" />
                              </div>
                              <select value={task.status} onChange={e=>updateTask(task.id,'status',e.target.value)}
                                className="w-full text-xs p-2 border border-[#E9E5DA] rounded-lg bg-white text-[#5A574E]">
                                <option value="todo">TO DO（待處理）</option>
                                <option value="doing">進行中</option>
                                <option value="done">已完成</option>
                              </select>
                              <div className="flex gap-2">
                                <button onClick={()=>{if(!task.title.trim())updateTask(task.id,'title','未命名項目');setEditingTaskId(null);setTimeout(()=>forceSave&&forceSave(),50);}}
                                  className="flex-1 bg-[#1F1D17] text-white text-xs font-semibold py-2 rounded-lg hover:bg-[#5A574E] transition-colors">確認張貼</button>
                                <button onClick={()=>{if(!task.title.trim())deleteTask(task.id);setEditingTaskId(null);}}
                                  className="border border-[#B8543C] text-[#B8543C] text-xs px-3 py-2 rounded-lg hover:bg-[#F0DDD3] transition-colors">取消</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-sm text-[#1F1D17] break-words">{task.title}</div>
                                  {task.desc && <div className="text-xs text-[#5A574E] mt-0.5 break-words whitespace-pre-wrap">{task.desc}</div>}
                                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${sC[task.status]}`}>{sL[task.status]}</span>
                                    {task.role && <span className="text-[10px] text-[#5A574E] bg-[#F6F3EB] px-1.5 py-0.5 rounded">{task.role}</span>}
                                    {task.time && <span className="text-[10px] text-[#8B887E]">{task.time}</span>}
                                  </div>
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                  <button onClick={()=>copyTask(task.id)} className="text-[#8B887E] hover:text-[#4F7E5C] hover:bg-[#F1EEE6] p-1.5 rounded-md transition-all" title="複製"><Copy size={13} strokeWidth={1.75} /></button>
                                  <button onClick={()=>setEditingTaskId(task.id)} className="text-[#8B887E] hover:text-[#1F1D17] hover:bg-[#F1EEE6] p-1.5 rounded-md transition-all" title="編輯"><Pencil size={13} strokeWidth={1.75} /></button>
                                  <button onClick={()=>deleteTask(task.id)} className="text-[#8B887E] hover:text-[#B8543C] hover:bg-[#F0DDD3] p-1.5 rounded-md transition-all" title="刪除"><Trash2 size={13} strokeWidth={1.75} /></button>
                                </div>
                              </div>
                              <SubtaskList
                                subtasks={task.subtasks || []}
                                roleNames={parseRoleNames(task.role)}
                                devMembers={data.devMembers || []}
                                sprint={{ ownerId: sprintOwnerId }}
                                planning={data.planning}
                                user={user}
                                sprintId={currentSprintId}
                                currentUserEmail={user?.email || ''}
                                readOnly={isViewOnly}
                                onChange={next => updateSubtasks(task.id, next)}
                                onAllDone={() => handleAllSubtasksDone(task.id)}
                                canDeleteAnyNote={canDeleteAnyNote}
                                onAppendNote={(subId, text, mentions) => appendSubtaskNote(task.id, subId, text, mentions)}
                                onDeleteNote={(subId, noteId) => deleteSubtaskNote(task.id, subId, noteId)}
                              />
                              <AttachmentBox
                                attachments={task.attachments || []}
                                sprintId={currentSprintId}
                                uploadedBy={user?.email || ''}
                                readOnly={isViewOnly}
                                onChange={next => updateAttachments(task.id, next)}
                              />
                              <ProgressLog
                                notes={task.notes || []}
                                currentUserEmail={user?.email || ''}
                                readOnly={isViewOnly}
                                devMembers={data.devMembers || []}
                                canDeleteAny={canDeleteAnyNote}
                                onAppend={(text, mentions) => appendTaskNote(task.id, text, mentions)}
                                onDelete={noteId => deleteTaskNote(task.id, noteId)}
                              />
                            </>
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

        {/* 桌面版 Kanban */}
        <section className="hidden md:flex bg-white border border-[#E9E5DA] rounded-xl overflow-hidden flex-col" style={{ minHeight: '650px' }}>
          <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-5 py-3 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#C96442] flex items-center justify-center flex-shrink-0">
                <Kanban size={13} strokeWidth={2} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-[#1F1D17]">
                <ScrumTooltip keyword="Sprint Backlog" text="任務看板 (Sprint Backlog)" />
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoRestore} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isPhotoRestoring}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#E9E5DA] bg-white text-[#5A574E] rounded-lg hover:shadow-sm hover:-translate-y-[1px] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Camera size={13} strokeWidth={1.75} />
                {isPhotoRestoring ? 'AI 解析中...' : '從照片還原'}
              </button>
              <button
                onClick={() => {
                  const newId = `pbi-${Date.now()}`;
                  setTasks([{ id: newId, type: 'pbi', status: 'pbi', title: '', desc: '', role: '', time: '' }, ...tasks]);
                  setEditingTaskId(newId);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#E9E5DA] bg-white text-[#C96442] rounded-lg hover:border-[#C96442] hover:shadow-sm hover:-translate-y-[1px] transition-all duration-150"
              >
                <Layers size={13} strokeWidth={1.75} />
                新增 PBI
              </button>
              <button
                onClick={() => {
                  const newId = `task-${Date.now()}`;
                  setTasks([{ id: newId, type: 'task', status: 'todo', title: '', desc: '', role: '', time: '' }, ...tasks]);
                  setEditingTaskId(newId);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#E9E5DA] bg-white text-[#5A574E] rounded-lg hover:shadow-sm hover:-translate-y-[1px] transition-all duration-150"
              >
                <Plus size={13} strokeWidth={1.75} />
                新增任務
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-[#FAF9F5] overflow-x-auto relative">
            {/* 欄位標頭列 */}
            <div className="flex border-b border-[#E9E5DA] min-w-[1050px]">
              <div className="w-64 md:w-72 flex-shrink-0 bg-[#F6F3EB] border-r border-[#E9E5DA] p-3 text-center sticky left-0 z-20 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.05)]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8B887E]">
                  <ScrumTooltip keyword="Product Backlog" text="排序的 PBI (1-5)" />
                </span>
              </div>
              <div className="flex-1 bg-[#FBF2ED] border-r border-[#E9E5DA] p-3 flex items-center justify-center gap-1.5 min-w-[200px]">
                <span className="w-2 h-2 rounded-full bg-[#B8543C] flex-shrink-0" />
                <span className="text-xs font-semibold text-[#5A574E]">TO DO (待處理)</span>
              </div>
              <div className="flex-1 bg-[#FAF4E7] border-r border-[#E9E5DA] p-3 flex items-center justify-center gap-1.5 min-w-[200px]">
                <span className="w-2 h-2 rounded-full bg-[#B8893A] flex-shrink-0" />
                <span className="text-xs font-semibold text-[#5A574E]">Doing (進行中)</span>
              </div>
              <div className="flex-1 bg-[#EFF4ED] border-r border-[#E9E5DA] p-3 flex items-center justify-center gap-1.5 min-w-[200px]">
                <span className="w-2 h-2 rounded-full bg-[#4F7E5C] flex-shrink-0" />
                <span className="text-xs font-semibold text-[#5A574E]">Done (已完成)</span>
              </div>
              <div className="flex-1 bg-[#F4F2EB] p-3 flex items-center justify-center gap-1.5 min-w-[200px]">
                <span className="w-2 h-2 rounded-full bg-[#8B887E] flex-shrink-0" />
                <span className="text-xs font-semibold text-[#5A574E]">
                  <ScrumTooltip keyword="Increment" text="驗收的 PBI (增量)" />
                </span>
              </div>
            </div>

            {/* Swimlanes */}
            <div className="flex-1 overflow-y-auto flex flex-col min-w-[1050px]">
              {tasks.filter(t => t.status === 'pbi').map((pbi) => (
                <div key={pbi.id} className="flex border-b border-[#E9E5DA] min-h-[250px] group relative items-stretch">

                  {/* PBI 欄（固定左側） */}
                  <div className="w-64 md:w-72 flex-shrink-0 p-3 border-r border-[#E9E5DA] bg-white sticky left-0 z-10 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.04)] flex flex-col"
                    onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'pbi', undefined, pbi.id)}>
                    {tasks.filter(t => t.id === pbi.id).map(task => {
                      const isEditing = editingTaskId === task.id;
                      return (
                        <div
                          key={task.id}
                          draggable={!isEditing}
                          onDragStart={(e) => onDragStart(e, task)}
                          onDragOver={onDragOver}
                          onDrop={(e) => { e.stopPropagation(); onDrop(e, 'pbi', task.id, undefined); }}
                          className={`bg-white border border-[#E9E5DA] border-l-[3px] border-l-[#C96442] p-3 rounded-xl transition-all duration-150 group/task relative flex-1
                            ${!isEditing ? 'cursor-grab active:cursor-grabbing hover:shadow-sm hover:-translate-y-[1px]' : 'shadow-sm'}
                          `}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F5E4DA] text-[#7A3520]">PBI</span>
                            {!isEditing && (
                              <div className="opacity-0 group-hover/task:opacity-100 transition-opacity flex gap-0.5 absolute top-2 right-2 bg-white/90 border border-[#E9E5DA] p-0.5 rounded-lg shadow-sm z-10">
                                <button onClick={() => moveTask(task.id, -1)} className="text-[#8B887E] hover:text-[#1F1D17] hover:bg-[#F1EEE6] p-1.5 rounded-md transition-all" title="向上排序"><ChevronUp size={13} strokeWidth={1.75} /></button>
                                <button onClick={() => moveTask(task.id, 1)} className="text-[#8B887E] hover:text-[#1F1D17] hover:bg-[#F1EEE6] p-1.5 rounded-md transition-all" title="向下排序"><ChevronDown size={13} strokeWidth={1.75} /></button>
                                <button onClick={() => copyTask(task.id)} className="text-[#8B887E] hover:text-[#4F7E5C] hover:bg-[#F1EEE6] p-1.5 rounded-md transition-all" title="複製"><Copy size={13} strokeWidth={1.75} /></button>
                                <button onClick={() => setEditingTaskId(task.id)} className="text-[#8B887E] hover:text-[#1F1D17] hover:bg-[#F1EEE6] p-1.5 rounded-md transition-all" title="編輯"><Pencil size={13} strokeWidth={1.75} /></button>
                                <button onClick={() => deleteTask(task.id)} className="text-[#8B887E] hover:text-[#B8543C] hover:bg-[#F0DDD3] p-1.5 rounded-md transition-all" title="刪除"><Trash2 size={13} strokeWidth={1.75} /></button>
                              </div>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="space-y-2 mt-2">
                              <input type="text" value={task.title} onChange={(e) => updateTask(task.id, 'title', e.target.value)}
                                className="w-full text-sm font-semibold p-2 border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA]" placeholder="PBI 標題" />
                              <textarea value={task.desc || ''} onChange={(e) => updateTask(task.id, 'desc', e.target.value)}
                                className="w-full text-xs p-2 border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA]" placeholder="PBI 描述說明 (選填)" rows={3} />
                              <div className="flex justify-end gap-2 mt-2">
                                <button onClick={() => { setEditingTaskId(null); setTimeout(() => forceSave && forceSave(), 50); }}
                                  className="text-xs font-semibold bg-[#1F1D17] text-white px-3 py-1.5 rounded-lg hover:bg-[#5A574E] transition-colors">完成</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <h4 className="text-sm font-semibold text-[#1F1D17] mb-1 break-all">{task.title || '(未命名項目)'}</h4>
                              {task.desc && <p className="text-xs text-[#5A574E] line-clamp-3 mb-2 whitespace-pre-wrap break-words">{task.desc}</p>}
                              <div onDragStart={e => e.stopPropagation()} draggable={false}>
                                <AttachmentBox
                                  attachments={task.attachments || []}
                                  sprintId={currentSprintId}
                                  uploadedBy={user?.email || ''}
                                  readOnly={isViewOnly}
                                  onChange={next => updateAttachments(task.id, next)}
                                />
                                <ProgressLog
                                  notes={task.notes || []}
                                  currentUserEmail={user?.email || ''}
                                  readOnly={isViewOnly}
                                  devMembers={data.devMembers || []}
                                  canDeleteAny={canDeleteAnyNote}
                                  onAppend={(text, mentions) => appendTaskNote(task.id, text, mentions)}
                                  onDelete={noteId => deleteTaskNote(task.id, noteId)}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* TODO 欄 */}
                  <div className="flex-1 p-2 border-r border-[#E9E5DA] bg-[#FBF2ED] flex flex-col min-w-[200px]"
                    onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'todo', undefined, pbi.id)}>
                    <div className="flex justify-end gap-1 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleAiGenerateTasks(pbi.id, pbi.title)}
                        disabled={isAiLoading}
                        className="flex items-center gap-1 text-xs border border-[#E9E5DA] text-[#5A574E] hover:border-[#8B887E] px-2 py-1 rounded-lg transition-all disabled:opacity-40"
                      >
                        <Bot size={11} strokeWidth={1.75} />
                        AI 拆解
                      </button>
                      <button
                        onClick={() => {
                          const newId = `task-${Date.now()}`;
                          setTasks((prev) => [{ id: newId, type: 'task', status: 'todo', title: '', desc: '', role: '', time: '', pbiId: pbi.id }, ...prev]);
                          setEditingTaskId(newId);
                        }}
                        className="flex items-center gap-1 text-xs border border-[#C96442] text-[#C96442] px-2 py-1 rounded-lg hover:bg-[#F5E4DA] transition-all"
                      >
                        <Plus size={11} strokeWidth={1.75} />
                        建立任務
                      </button>
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                      {renderTasks('todo', pbi.id)}
                    </div>
                  </div>

                  {/* Doing 欄 */}
                  <div className="flex-1 p-2 border-r border-[#E9E5DA] bg-[#FAF4E7] min-w-[200px]"
                    onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'doing', undefined, pbi.id)}>
                    <div className="flex flex-col gap-2 h-full">
                      {renderTasks('doing', pbi.id)}
                    </div>
                  </div>

                  {/* Done 欄 */}
                  <div className="flex-1 p-2 border-r border-[#E9E5DA] bg-[#EFF4ED] min-w-[200px]"
                    onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'done', undefined, pbi.id)}>
                    <div className="flex flex-col gap-2 h-full">
                      {renderTasks('done', pbi.id)}
                    </div>
                  </div>

                  {/* 驗收欄 */}
                  <div className="flex-1 p-4 bg-[#F4F2EB] flex flex-col items-center justify-center min-w-[200px] gap-3">
                    {pbi.acceptedBy ? (
                      <div className="flex flex-col items-center gap-2 border border-[#4F7E5C] rounded-xl px-4 py-4 bg-[#DDE6D9] w-full text-center">
                        <CheckCircle2 size={22} strokeWidth={1.75} className="text-[#4F7E5C]" />
                        <div className="text-xs font-semibold text-[#4F7E5C] uppercase tracking-wider">已驗收</div>
                        <div className="font-semibold text-[#1F1D17] text-sm">{pbi.acceptedBy}</div>
                        <div className="text-xs text-[#8B887E]">{pbi.acceptedAt}</div>
                        <button onClick={() => cancelAcceptPbi(pbi.id)} className="text-[10px] text-[#5A574E] underline hover:text-[#1F1D17] mt-1">
                          取消驗收
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="text-[#B5B2A6] text-xs select-none">對應 PBI 增量</div>
                        {poName && (
                          <button
                            onClick={() => acceptPbi(pbi.id)}
                            className="flex items-center gap-1.5 bg-[#1F1D17] text-white text-xs font-semibold px-4 py-2 rounded-[9px] hover:bg-[#5A574E] hover:shadow-md hover:-translate-y-[1px] transition-all duration-150"
                          >
                            <CheckCircle2 size={13} strokeWidth={1.75} />
                            驗收確認
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
