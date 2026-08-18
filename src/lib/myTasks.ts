// 跨 Sprint 的個人待辦聚合與寫回。
//
// 讀取：sprint 文件本身就含 backlog，fetchAccessibleSprints 一次 getDocs
// 即取得全部所需資料，不需要額外讀取。
//
// 寫回：/my-tasks 同時面對多個 Sprint，useAutoSave（綁定單一 sprintId）不適用。
// 改用 transaction 先讀最新 tasks 再只改目標項目，避免整包覆寫蓋掉他人編輯。

import { doc, runTransaction, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';
import type { Task, Subtask, ProgressNote } from './taskTypes';
import { normEmail } from './permissions';

export interface SprintDoc {
  id: string;
  name?: string;
  ownerId?: string;
  sprintStatus?: 'pending' | 'in-progress' | 'completed';
  backlog?: { tasks?: Task[]; devMembers?: { name: string; email: string }[] };
  planning?: { po?: string; sm?: string; devsList?: { name: string; role?: string; email?: string }[] };
}

export interface MyTaskItem {
  sprintId: string;
  sprintName: string;
  task: Task;
  /** 有子任務時為該子任務；整張任務只有我一人負責且無子任務時為 null */
  subtask: Subtask | null;
  title: string;
  status: 'todo' | 'doing' | 'done';
}

export interface Actor {
  email?: string | null;
  displayName?: string | null;
}

/** 預設只保留進行中與待開始；sprintStatus 缺失時視為 pending 納入 */
export function isActiveSprint(s: SprintDoc): boolean {
  return (s.sprintStatus ?? 'pending') !== 'completed';
}

/** 從 Sprint 清單展開出指派給該 email 的項目 */
export function collectMyItems(sprints: SprintDoc[], email?: string | null): MyTaskItem[] {
  const me = normEmail(email);
  if (!me) return [];
  const out: MyTaskItem[] = [];

  for (const s of sprints) {
    const tasks = s.backlog?.tasks || [];
    const members = s.backlog?.devMembers || [];
    const myNames = members.filter(m => normEmail(m.email) === me).map(m => m.name);

    for (const t of tasks) {
      if (t.type !== 'task') continue;
      const subs = t.subtasks || [];

      if (subs.length > 0) {
        for (const sub of subs) {
          if (normEmail(sub.assigneeEmail) !== me) continue;
          out.push({
            sprintId: s.id,
            sprintName: s.name || '(未命名專案)',
            task: t,
            subtask: sub,
            title: sub.title || t.title || '(未命名)',
            status: sub.status,
          });
        }
        continue;
      }

      // 無子任務：整張任務只掛我一人時才算我的待辦
      const roleNames = (t.role || '').split(/[,、，\n]/).map(x => x.trim()).filter(Boolean);
      const mineOnly = roleNames.length === 1 && myNames.includes(roleNames[0]);
      if (!mineOnly) continue;
      if (t.status !== 'todo' && t.status !== 'doing' && t.status !== 'done') continue;
      out.push({
        sprintId: s.id,
        sprintName: s.name || '(未命名專案)',
        task: t,
        subtask: null,
        title: t.title || '(未命名)',
        status: t.status,
      });
    }
  }
  return out;
}

function historyEntry(actor: Actor, changes: string) {
  return {
    email: actor.email || '',
    name: actor.displayName || actor.email || '',
    ts: Date.now(),
    page: 'my-tasks',
    changes,
  };
}

/** 更新指定 Sprint 內某個子任務。使用 transaction 避免覆蓋他人同時的編輯。 */
export async function updateSubtaskInSprint(
  sprintId: string,
  taskId: string,
  subtaskId: string,
  patch: Partial<Subtask>,
  actor: Actor
): Promise<void> {
  const ref = doc(db, 'sprints', sprintId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('找不到這個專案');
    const tasks: Task[] = snap.data().backlog?.tasks || [];
    const next = tasks.map(t => t.id !== taskId ? t : ({
      ...t,
      subtasks: (t.subtasks || []).map(s => s.id !== subtaskId
        ? s
        : ({ ...s, ...patch, updatedAt: Date.now() })),
    }));
    // 用 dotted path 只改 backlog.tasks，不動 backlog 底下其他欄位
    tx.update(ref, {
      'backlog.tasks': next,
      editHistory: arrayUnion(historyEntry(actor, `子任務：${Object.keys(patch).join('、')} 已更新`)),
    });
  });
}

/** 更新指定 Sprint 內某張任務（無子任務的單人任務用）。 */
export async function updateTaskInSprint(
  sprintId: string,
  taskId: string,
  patch: Partial<Task>,
  actor: Actor
): Promise<void> {
  const ref = doc(db, 'sprints', sprintId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('找不到這個專案');
    const tasks: Task[] = snap.data().backlog?.tasks || [];
    const next = tasks.map(t => t.id !== taskId ? t : ({ ...t, ...patch }));
    tx.update(ref, {
      'backlog.tasks': next,
      editHistory: arrayUnion(historyEntry(actor, `任務：${Object.keys(patch).join('、')} 已更新`)),
    });
  });
}

// ── 進度紀錄 ─────────────────────────────────────────────────────────────
//
// 追加與刪除都在 transaction 內部先讀出當下的 notes 再改，而不是由呼叫端
// 算好整包陣列送進來。兩個人同時記錄時，後者若帶著自己讀到的舊陣列覆寫，
// 前者那則就會被吃掉——這正是 backlog 整包覆寫踩過的同一個坑。

/**
 * 建立一則進度紀錄。刻意由呼叫端先建好再傳進 appendNoteInSprint：
 * 若讓伺服器端另外產生 id，前端樂觀插入的那則會有不同的 id，使用者剛記錄完
 * 馬上按刪除就會刪不掉（伺服器找不到那個 id），重新整理後又冒出來。
 */
export function makeNote(text: string, actor: Actor): ProgressNote | null {
  const body = text.trim();
  if (!body) return null;
  return {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: body,
    authorName: actor.displayName || actor.email || '未具名',
    authorEmail: (actor.email || '').trim().toLowerCase(),
    ts: Date.now(),
  };
}

/** 對某張任務（subtaskId 為 null）或某條子任務追加一則進度紀錄。 */
export async function appendNoteInSprint(
  sprintId: string,
  taskId: string,
  subtaskId: string | null,
  note: ProgressNote,
  actor: Actor
): Promise<void> {
  const body = note.text;
  const ref = doc(db, 'sprints', sprintId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('找不到這個專案');
    const tasks: Task[] = snap.data().backlog?.tasks || [];

    const next = tasks.map(t => {
      if (t.id !== taskId) return t;
      if (!subtaskId) return { ...t, notes: [...(t.notes || []), note] };
      return {
        ...t,
        subtasks: (t.subtasks || []).map(s => s.id !== subtaskId
          ? s
          : { ...s, notes: [...(s.notes || []), note], updatedAt: Date.now() }),
      };
    });

    tx.update(ref, {
      'backlog.tasks': next,
      editHistory: arrayUnion(historyEntry(actor, `進度紀錄：${body.slice(0, 20)}${body.length > 20 ? '…' : ''}`)),
    });
  });
}

/** 刪除一則進度紀錄。權限已在 UI 判斷，這裡只負責原子性地移除。 */
export async function deleteNoteInSprint(
  sprintId: string,
  taskId: string,
  subtaskId: string | null,
  noteId: string,
  actor: Actor
): Promise<void> {
  const ref = doc(db, 'sprints', sprintId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('找不到這個專案');
    const tasks: Task[] = snap.data().backlog?.tasks || [];

    const next = tasks.map(t => {
      if (t.id !== taskId) return t;
      if (!subtaskId) return { ...t, notes: (t.notes || []).filter(n => n.id !== noteId) };
      return {
        ...t,
        subtasks: (t.subtasks || []).map(s => s.id !== subtaskId
          ? s
          : { ...s, notes: (s.notes || []).filter(n => n.id !== noteId), updatedAt: Date.now() }),
      };
    });

    tx.update(ref, {
      'backlog.tasks': next,
      editHistory: arrayUnion(historyEntry(actor, '進度紀錄：刪除一則')),
    });
  });
}
