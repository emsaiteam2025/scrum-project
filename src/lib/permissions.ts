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
  /**
   * 主編輯：可編輯這個 Sprint 的任何東西（含別人的子任務）。
   * 在 Sprint Planning 成員表勾選。比對身分靠 email，因此沒填 email 的成員
   * 勾了也不會生效——UI 端已停用該情況的勾選框。
   */
  isLead?: boolean;
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
  if (!me) return false;

  // 明確勾選的主編輯
  if (me.isLead) return true;

  // 舊規則：姓名等於 PO/SM。保留但脆弱——po/sm 存的是自由輸入的姓名字串，
  // 只有在它恰好等於某位有填 email 的成員姓名時才生效。
  const myName = (me.name || '').trim();
  if (!myName) return false;
  return [planning?.po, planning?.sm]
    .map(v => (v || '').trim())
    .filter(Boolean)
    .includes(myName);
}

/**
 * 子任務可否編輯：全權編輯者、本人，或「這條子任務根本沒有身分可比對」時的任何登入者。
 *
 * 最後那條是刻意的：assigneeEmail 為空代表該成員在 Sprint Planning 沒填 Email
 * （舊資料或還沒補），此時鎖住等於誰都不能動，但擋不住任何人——firestore.rules
 * 本來就允許任何登入者寫入任何 sprint，這層鎖是協作提示而非安全機制。
 * 為了資料不全就讓整個團隊動不了，代價遠大於它擋下的東西（它什麼也沒擋下）。
 * 正解是去把 Email 補上，UI 會標出未填 Email 的成員提醒使用者。
 */
export function canEditSubtask(
  subtask: Pick<Subtask, 'assigneeEmail'>,
  sprint: SprintLike | null | undefined,
  planning: PlanningLike | null | undefined,
  user: UserLike | null | undefined
): boolean {
  if (isSprintAdmin(sprint, planning, user)) return true;
  if (!user) return false;
  const owner = normEmail(subtask.assigneeEmail);
  if (!owner) return true;          // 無身分可鎖 → 不擋（見上方說明）
  if (!user.email) return false;
  return owner === normEmail(user.email);
}
