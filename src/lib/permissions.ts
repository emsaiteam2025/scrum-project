// 成員身分比對與編輯權限判斷。
//
// 權限採 UI 鎖定策略（不改 Firestore 規則）：非本人的子任務在介面上唯讀，
// 所有修改仍記入既有的 editHistory。這適用於內部信任的團隊。

import type { Subtask } from '@/lib/taskTypes';

export interface PlanningMember {
  id?: string;
  name: string;
  role?: string;
  email?: string;
}

export interface PlanningLike {
  po?: string;
  sm?: string;
  devsList?: PlanningMember[];
}

export interface SprintLike {
  ownerId?: string;
}

export interface UserLike {
  uid?: string;
  email?: string | null;
}

export const normEmail = (e?: string | null): string => (e || '').trim().toLowerCase();

/** 用登入者的 email 從 Planning 成員表找出「我是誰」。找不到回傳 null。 */
export function findMemberByEmail(
  planning: PlanningLike | null | undefined,
  email?: string | null
): PlanningMember | null {
  const target = normEmail(email);
  if (!target) return null;
  const list = planning?.devsList || [];
  return list.find(m => normEmail(m.email) === target) || null;
}

/**
 * 全權編輯者：Sprint 擁有者，或我的姓名等於 planning.po / planning.sm。
 * 注意 po / sm 存的是姓名而非 email，所以要先經 devsList 換出姓名再比對。
 */
export function isSprintAdmin(
  sprint: SprintLike | null | undefined,
  planning: PlanningLike | null | undefined,
  user: UserLike | null | undefined
): boolean {
  if (!user) return false;
  // 舊資料沒有 ownerId，視同擁有者（與 src/app/page.tsx:1079 既有判斷一致）
  if (!sprint?.ownerId || sprint.ownerId === user.uid) return true;

  const me = findMemberByEmail(planning, user.email);
  if (!me?.name) return false;
  const myName = me.name.trim();
  if (!myName) return false;
  return [planning?.po, planning?.sm]
    .map(v => (v || '').trim())
    .filter(Boolean)
    .includes(myName);
}

/** 子任務可否編輯：全權編輯者，或本人。子任務沒填 assigneeEmail 時只有全權編輯者能改。 */
export function canEditSubtask(
  subtask: Pick<Subtask, 'assigneeEmail'>,
  sprint: SprintLike | null | undefined,
  planning: PlanningLike | null | undefined,
  user: UserLike | null | undefined
): boolean {
  if (isSprintAdmin(sprint, planning, user)) return true;
  if (!user?.email) return false;
  const owner = normEmail(subtask.assigneeEmail);
  if (!owner) return false;
  return owner === normEmail(user.email);
}
