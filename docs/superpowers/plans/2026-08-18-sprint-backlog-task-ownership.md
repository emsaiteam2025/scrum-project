# Sprint Backlog 專案管理化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓每位開發人員登入後看得到並編輯屬於自己的工作，能在共同任務中切分出自己負責的段落，並為工作附上檔案與圖片。

**Architecture:** 在既有 `sprints/{id}.backlog.tasks[]` 陣列內加一層 `subtasks[]`，不動 Firestore 儲存結構與 `useAutoSave` 契約。身分靠 Planning 成員表新增的 `email` 欄位比對登入者，權限以 UI 鎖定（非本人的子任務唯讀）。個人待辦 `/my-tasks` 沿用 `fetchAccessibleSprints()` 一次抓回 Sprint 文件即完成跨 Sprint 聚合，寫回改用 Firestore transaction 避免整包覆寫。附件走 Vercel Blob。

**Tech Stack:** Next.js 14 App Router, TypeScript, Firebase Firestore/Auth, Vercel Blob (`@vercel/blob`), Tailwind CSS, lucide-react

**Spec:** `docs/superpowers/specs/2026-08-18-sprint-backlog-task-ownership-design.md`

## Global Constraints

- **本專案沒有任何測試框架**（無 jest/vitest、無 test script、無測試檔）。本計畫不導入測試框架——那不在 spec 範圍內。每個 Task 的驗證方式為 `npm run lint` + `npm run build` + 明確寫出的手動驗證步驟。
- **不得改動 `Task.role` 的既有語意**。它是逗號分隔姓名字串，`/workload`、`/report`、`/daily-scrum` 都在讀它。
- **不得改動 `backlog.devsList` 的型別**。它是 `string[]`（純姓名），與 `planning.devsList` 的 `{id,name,role}[]` 同名但不同型別，兩者不可混用。新資料一律走新欄位 `backlog.devMembers`。
- **不得改動 `useAutoSave` 的儲存契約**（`src/hooks/useAutoSave.ts` 本次完全不動）。
- **backlog 頁有兩套渲染**：桌機看板 `renderTasks()`（`src/app/backlog/page.tsx:457` 起）與手機版 PBI 分組檢視（同檔 `:893` 起）。任何卡片上的新 UI，兩邊都要接。
- Email 比對一律 `.trim().toLowerCase()` 正規化。
- 所有面向使用者的文字用繁體中文。
- 配色沿用既有 token：主色 `#C96442`、文字 `#1F1D17` / `#5A574E` / `#8B887E`、邊框 `#E9E5DA`、底色 `#F6F3EB` / `#F1EEE6`。
- 版本號在 Task 9 統一 bump，中途各 Task 不要各自改版本號。

---

## 檔案清單

| 動作 | 路徑 | 責任 |
|------|------|------|
| 新增 | `src/lib/taskTypes.ts` | `Task` / `Subtask` / `Attachment` 共用型別 |
| 新增 | `src/lib/permissions.ts` | 成員身分比對、編輯權限判斷 |
| 新增 | `src/lib/myTasks.ts` | 跨 Sprint 聚合、transaction 寫回 |
| 新增 | `src/components/SubtaskList.tsx` | 子任務清單與編輯 |
| 新增 | `src/components/AttachmentBox.tsx` | 附件上傳／預覽／刪除 |
| 新增 | `src/app/api/upload/route.ts` | Vercel Blob 上傳與刪除 |
| 新增 | `src/app/my-tasks/page.tsx` | 個人待辦頁 |
| 修改 | `src/app/planning/page.tsx` | 成員表加 email 欄位、同步 collaborators |
| 修改 | `src/app/backlog/page.tsx` | 改用共用型別、同步 devMembers、接入子任務與附件 |
| 修改 | `src/components/Navigation.tsx` | 「我的工作」入口、版本號 |
| 修改 | `package.json` | `@vercel/blob` 相依、版本號 |

---

### Task 1：共用型別 `src/lib/taskTypes.ts`

把目前寫死在 `src/app/backlog/page.tsx:14` 的 `Task` 介面抽成共用檔，`/my-tasks` 才能共用同一組型別。

**Files:**
- Create: `src/lib/taskTypes.ts`
- Modify: `src/app/backlog/page.tsx:14-25`（刪除本地 interface，改為 import）

**Interfaces:**
- Produces: `Attachment`、`Subtask`、`Task`、`DevMember` 四個型別，以及 `parseRoleNames(role?: string): string[]`

- [ ] **Step 1：建立 `src/lib/taskTypes.ts`**

```ts
// Sprint Backlog 的共用型別。
// 原本 Task 寫在 backlog/page.tsx 內，因 /my-tasks 需要共用而抽出。
// 注意：Task 同時代表 PBI（type: 'pbi'）與任務（type: 'task'），
// 因此 attachments 一個欄位即涵蓋 PBI 與任務兩層。

export interface Attachment {
  id: string;
  name: string;
  url: string;            // Vercel Blob URL
  size: number;           // bytes
  contentType: string;
  uploadedBy: string;     // email
  uploadedAt: number;     // Date.now()
}

export interface Subtask {
  id: string;
  title: string;          // 這位負責人負責的內容
  desc?: string;
  assignee: string;       // 開發者姓名，單一負責人
  assigneeEmail?: string; // 權限判斷依據；成員未填 email 時為 undefined
  status: 'todo' | 'doing' | 'done';
  time?: string;
  attachments?: Attachment[];
  updatedAt?: number;
}

export interface Task {
  id: string;
  type: 'pbi' | 'task';
  status: 'pbi' | 'todo' | 'doing' | 'done' | 'accepted';
  title: string;
  desc?: string;
  role?: string;          // 逗號分隔姓名字串，語意不可更動
  time?: string;
  pbiId?: string;
  acceptedBy?: string;
  acceptedAt?: string;
  color?: string;
  subtasks?: Subtask[];
  attachments?: Attachment[];
}

// Planning 成員在 backlog 端的精簡形狀（存於 backlog.devMembers）
export interface DevMember {
  name: string;
  email: string;          // 未填時為空字串
}

// task.role 的拆解方式必須與 backlog/page.tsx:123 既有寫法一致
export function parseRoleNames(role?: string): string[] {
  return (role || '')
    .split(/[,、，\n]/)
    .map(s => s.trim())
    .filter(Boolean);
}
```

- [ ] **Step 2：改 `src/app/backlog/page.tsx` 改用共用型別**

刪除第 14–25 行的本地 `interface Task { ... }`，在檔案上方 import 區加入：

```ts
import type { Task, Subtask, Attachment, DevMember } from '@/lib/taskTypes';
import { parseRoleNames } from '@/lib/taskTypes';
```

`const initialTasks: Task[] = [];` 保持不變。

- [ ] **Step 3：驗證編譯**

```bash
npm run lint && npm run build
```

Expected: 兩者皆通過，無 TypeScript 錯誤。若出現 `Task` 未定義，代表 import 沒加上。

- [ ] **Step 4：Commit**

```bash
git add src/lib/taskTypes.ts src/app/backlog/page.tsx
git commit -m "refactor: 抽出 Sprint Backlog 共用型別到 src/lib/taskTypes.ts"
```

---

### Task 2：Planning 成員表加 Email 欄位

**Files:**
- Modify: `src/app/planning/page.tsx:38`（型別）、`:65-79`（updateDev/addDev/removeDev）、`:648-678`（成員列 UI）

**Interfaces:**
- Consumes: 無
- Produces: `planning.devsList[].email`（string，選填）；副作用是把 email 同步進 `sprints/{id}.collaborators` 與 `collaboratorEmails`

- [ ] **Step 1：擴充 devsList 型別**

`src/app/planning/page.tsx:38`，把

```ts
    devsList: [{ id: '1', name: '', role: '' }] as { id: string; name: string; role: string }[],
```

改成

```ts
    devsList: [{ id: '1', name: '', role: '', email: '' }] as { id: string; name: string; role: string; email: string }[],
```

同步修改 `syncDevsString`、`updateDev`、`addDev`、`removeDev` 四個函式的型別標註（`:65` 起），把 `{ id: string; name: string; role: string }` 一律換成 `{ id: string; name: string; role: string; email: string }`。

`updateDev` 的 field 參數放寬：

```ts
  const updateDev = (index: number, field: 'name' | 'role' | 'email', value: string) => {
```

`addDev` 新增的物件補上 `email: ''`：

```ts
    const list = [...(data.devsList || []), { id: Date.now().toString(), name: '', role: '', email: '' }];
```

`removeDev` 的 fallback 物件同樣補 `email: ''`。

舊資料相容的 hydrate 邏輯（`:47-58`）產生的物件也要補 `email: ''`：

```ts
          devsList: names.map((name, i) => ({ id: `${Date.now()}-${i}`, name, role: '', email: '' }))
```

- [ ] **Step 2：新增「同步協作者」函式**

在 `removeDev` 之後加入。這段把成員 email 寫進 Sprint 的協作者清單，讓「指定身分」與「邀請協作」一次完成。寫法刻意與 `src/app/page.tsx:823` 的 `handleAddCollaborator` 保持一致（同樣的 `collaborators` + `collaboratorEmails` 雙欄位維護）。

```ts
  // 把成員表裡填了 email 的人自動加進 Sprint 協作者（editor），
  // 讓他登入後能讀到這個 Sprint。已存在者不覆蓋其原有角色。
  const syncMembersToCollaborators = React.useCallback(async () => {
    const sprintId = localStorage.getItem('currentSprintId');
    if (!sprintId) return;
    const memberEmails = (data.devsList || [])
      .map(d => (d.email || '').trim().toLowerCase())
      .filter(Boolean);
    if (memberEmails.length === 0) return;

    try {
      const { doc, getDoc, setDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const ref = doc(db, 'sprints', sprintId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;

      const existing: { email: string; role: string }[] = snap.data().collaborators || [];
      const existingSet = new Set(existing.map(c => (c.email || '').toLowerCase()));
      const toAdd = memberEmails.filter(e => !existingSet.has(e));
      if (toAdd.length === 0) return;

      const merged = [...existing, ...toAdd.map(email => ({ email, role: 'editor' }))];
      await setDoc(ref, {
        collaborators: merged,
        collaboratorEmails: merged.map(c => (c.email || '').toLowerCase()),
      }, { merge: true });
    } catch (err) {
      console.warn('[Planning] 同步協作者失敗', err);
    }
  }, [data.devsList]);
```

- [ ] **Step 3：在成員 email 失焦時觸發同步**

Email 輸入框用 `onBlur` 觸發，不要用 `onChange`——每打一個字就寫一次 Firestore 是不能接受的。

- [ ] **Step 4：加入 email 輸入框**

`src/app/planning/page.tsx:648` 起的成員列，在「角色」輸入框與移除按鈕之間插入 email 欄位。同時把整列改為兩行排版（手機上三個欄位擠在一行會太窄）。

把原本的

```tsx
                      <div key={dev.id} className="flex items-center gap-2 px-3 py-2">
```

那一整塊（到對應的 `</div>` 為止）改成：

```tsx
                      <div key={dev.id} className="flex items-start gap-2 px-3 py-2">
                        <span
                          className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: AV_PAL[i % AV_PAL.length] }}
                        >
                          {(dev.name || '?').slice(0, 1) || '?'}
                        </span>
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={dev.name}
                              onChange={e => updateDev(i, 'name', e.target.value)}
                              className="flex-1 min-w-0 bg-transparent border-b border-transparent focus:border-[#C96442] outline-none text-sm text-[#1F1D17] placeholder-[#B5B2A6]"
                              placeholder="姓名"
                            />
                            <input
                              type="text"
                              value={dev.role}
                              onChange={e => updateDev(i, 'role', e.target.value)}
                              className="w-32 bg-transparent border-b border-transparent focus:border-[#C96442] outline-none text-xs text-[#8B887E] placeholder-[#B5B2A6]"
                              placeholder="角色（例：Tech Lead）"
                            />
                          </div>
                          <input
                            type="email"
                            value={dev.email || ''}
                            onChange={e => updateDev(i, 'email', e.target.value)}
                            onBlur={() => syncMembersToCollaborators()}
                            className="bg-transparent border-b border-transparent focus:border-[#C96442] outline-none text-xs text-[#8B887E] placeholder-[#B5B2A6]"
                            placeholder="Google 帳號 Email（填了才能登入認領自己的工作）"
                          />
                        </div>
                        <button
                          onClick={() => removeDev(i)}
                          className="text-[#B5B2A6] hover:text-[#B8543C] px-1.5 py-1 rounded transition-colors shrink-0 mt-0.5"
                          title="移除這位成員"
                        >
                          <X size={14} strokeWidth={1.75} />
                        </button>
                      </div>
```

- [ ] **Step 5：加入說明文字**

在「新增成員」按鈕（`:679`）之後插入：

```tsx
                  <div className="text-xs text-[#8B887E]">
                    填入成員的 Google 帳號 Email 後，該成員會自動成為本專案協作者，登入後即可在「我的工作」看到並編輯指派給自己的項目。
                  </div>
```

- [ ] **Step 6：驗證**

```bash
npm run lint && npm run build
```

手動驗證：
1. `npm run dev` 後開 `http://localhost:3033/planning?sprint=<某個 sprint id>`
2. 成員列出現第二行 email 欄位
3. 填入一個 email 後點到別處（觸發 blur）
4. 回專案大廳點該 Sprint 的分享，確認該 email 已出現在協作者清單且角色為 editor

- [ ] **Step 7：Commit**

```bash
git add src/app/planning/page.tsx
git commit -m "feat: Planning 成員表加入 Email 欄位並自動同步為專案協作者"
```

---

### Task 3：權限模組 `src/lib/permissions.ts`

**Files:**
- Create: `src/lib/permissions.ts`

**Interfaces:**
- Consumes: Task 1 的 `Subtask` 型別
- Produces:
  - `normEmail(e?: string | null): string`
  - `PlanningLike`（型別）
  - `findMemberByEmail(planning: PlanningLike | null | undefined, email?: string | null): PlanningMember | null`
  - `isSprintAdmin(sprint, planning, user): boolean`
  - `canEditSubtask(subtask, sprint, planning, user): boolean`

- [ ] **Step 1：建立 `src/lib/permissions.ts`**

關鍵細節：`planning.po` 與 `planning.sm` 存的是**姓名字串**不是 email，所以 admin 判斷必須分兩步——先用 email 從 `devsList` 找出我的 `name`，再比對該 name 是否為 po / sm。

```ts
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
```

- [ ] **Step 2：驗證編譯**

```bash
npm run lint && npm run build
```

Expected: 通過。此檔尚未被引用，只驗證型別正確。

- [ ] **Step 3：Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat: 新增成員身分比對與子任務編輯權限模組"
```

---

### Task 4：Backlog 同步 devMembers（姓名＋Email）

Backlog 目前只從 `planning.devs`（純字串）拆出姓名存進 `backlog.devsList: string[]`。子任務需要 email 才能綁定身分，因此新增 `backlog.devMembers`。**`devsList` 保持原樣不動**——它被 `:530` 與 `:968` 兩處 UI 使用中。

**Files:**
- Modify: `src/app/backlog/page.tsx:52-58`（useAutoSave 初始值）、`:122-126`（Planning 同步邏輯）

**Interfaces:**
- Consumes: Task 1 的 `DevMember`；Task 2 產生的 `planning.devsList[].email`
- Produces: `backlog.devMembers: DevMember[]`

- [ ] **Step 1：useAutoSave 初始值加入 devMembers**

`src/app/backlog/page.tsx:52`，把

```ts
  const { data, updateData, syncData, loading, forceSave, saveStatus } = useAutoSave('backlog', {
    sprintDays: 30 as number | string,
    tasks: initialTasks,
    sprintGoal: '',
    stakeholders: '',
    devsList: [] as string[]
  });
```

改成

```ts
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
```

- [ ] **Step 2：同步 devMembers 與 planning 快照**

`src/app/backlog/page.tsx:122`，把

```ts
          if (planningData.devs) {
            const devsArray = planningData.devs.split(/[,、，\n]/).map((d: string) => d.trim()).filter((d: string) => d);
            if (!isPublicViewer || auth.currentUser) {
               syncData({ devsList: devsArray });
            }
          }
```

改成

```ts
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
```

`syncData` 不會標記 dirty，所以這段同步不會觸發多餘的儲存（與既有行為一致）。

- [ ] **Step 3：載入目前 Sprint 的 ownerId**

權限判斷需要 `sprint.ownerId`。在 `src/app/backlog/page.tsx` 的 state 區（`:34` 附近）加入：

```ts
  const [sprintOwnerId, setSprintOwnerId] = useState<string | undefined>(undefined);
```

在既有的 Planning 同步 `useEffect` 內，取得 `snap` 之後補上（在 `if (snap.exists() && snap.data().planning)` 之前）：

```ts
          if (snap.exists()) setSprintOwnerId(snap.data().ownerId);
```

注意該處目前的寫法是 `const snap = await getDoc(docRef);`，`snap` 在該 scope 內可用。

- [ ] **Step 4：驗證**

```bash
npm run lint && npm run build
```

手動驗證：
1. 在 Planning 填好兩位成員的姓名與 email
2. 切到 Backlog，開瀏覽器 DevTools Console 執行
   `JSON.parse(localStorage.getItem('draft_sprint_<sprintId>_backlog') || '{}').devMembers`
   （若無草稿則到 Firestore Console 看 `sprints/{id}.backlog.devMembers`）
3. 應看到 `[{name, email}, ...]`，且 `devsList` 仍為姓名字串陣列

- [ ] **Step 5：Commit**

```bash
git add src/app/backlog/page.tsx
git commit -m "feat: Backlog 從 Planning 同步成員 Email 與 PO/SM 快照"
```

---

### Task 5：子任務元件 `SubtaskList.tsx`

**Files:**
- Create: `src/components/SubtaskList.tsx`

**Interfaces:**
- Consumes: Task 1 的 `Subtask` / `DevMember`、Task 3 的 `canEditSubtask`
- Produces: `SubtaskList` 預設匯出，props 見下

- [ ] **Step 1：建立 `src/components/SubtaskList.tsx`**

元件本身不碰 Firestore——狀態變更一律透過 `onChange` 回呼交給呼叫端。這讓同一個元件能同時用在 Backlog（走 `useAutoSave`）與 `/my-tasks`（走 transaction）。

```tsx
"use client";
import React from 'react';
import { Plus, Trash2, Split } from 'lucide-react';
import type { Subtask, DevMember } from '@/lib/taskTypes';
import { canEditSubtask, type PlanningLike, type SprintLike, type UserLike } from '@/lib/permissions';

export interface SubtaskListProps {
  subtasks: Subtask[];
  /** task.role 解析出的姓名陣列，用來判斷「拆分」按鈕要不要出現 */
  roleNames: string[];
  devMembers: DevMember[];
  sprint: SprintLike | null | undefined;
  planning: PlanningLike | null | undefined;
  user: UserLike | null | undefined;
  /** 附件上傳用（Task 8 才會真正接上 AttachmentBox，這裡先定義好避免之後改動呼叫端） */
  sprintId: string;
  currentUserEmail: string;
  onChange: (next: Subtask[]) => void;
  /** 整張卡唯讀（例如公開連結檢視模式） */
  readOnly?: boolean;
  /** 子任務全數完成時呼叫，由呼叫端決定要不要詢問標記父任務完成 */
  onAllDone?: () => void;
}

const STATUS_LABEL: Record<Subtask['status'], string> = {
  todo: '待辦',
  doing: '進行中',
  done: '完成',
};

const STATUS_STYLE: Record<Subtask['status'], string> = {
  todo: 'bg-[#F0DDD3] text-[#B8543C]',
  doing: 'bg-[#F0E4C9] text-[#B8893A]',
  done: 'bg-[#DDE6D9] text-[#4F7E5C]',
};

export default function SubtaskList({
  subtasks, roleNames, devMembers, sprint, planning, user,
  sprintId, currentUserEmail, onChange, readOnly, onAllDone,
}: SubtaskListProps) {
  const list = subtasks || [];

  const emailOf = (name: string): string =>
    (devMembers || []).find(m => m.name === name)?.email || '';

  // 只開放字串型欄位，避免 keyof Subtask 讓 attachments 之類的欄位被塞進字串
  type TextField = 'title' | 'desc' | 'time';

  const patchText = (id: string, field: TextField, value: string) => {
    onChange(list.map(s => s.id === id ? { ...s, [field]: value, updatedAt: Date.now() } : s));
  };

  const patchStatus = (id: string, value: string) => {
    const status = value as Subtask['status'];
    const next = list.map(s => s.id === id ? { ...s, status, updatedAt: Date.now() } : s);
    onChange(next);
    if (next.length > 0 && next.every(s => s.status === 'done')) {
      onAllDone?.();
    }
  };

  const addSubtask = (assignee: string) => {
    onChange([...list, {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: '',
      assignee,
      assigneeEmail: emailOf(assignee),
      status: 'todo',
      updatedAt: Date.now(),
    }]);
  };

  /** 依 task.role 為每位尚未有子任務的負責人各產生一條 */
  const splitByRole = () => {
    const existing = new Set(list.map(s => s.assignee));
    const created: Subtask[] = roleNames
      .filter(n => !existing.has(n))
      .map((name, i) => ({
        id: `sub-${Date.now()}-${i}`,
        title: '',
        assignee: name,
        assigneeEmail: emailOf(name),
        status: 'todo' as const,
        updatedAt: Date.now(),
      }));
    if (created.length === 0) return;
    onChange([...list, ...created]);
  };

  const removeSubtask = (id: string) => {
    onChange(list.filter(s => s.id !== id));
  };

  const doneCount = list.filter(s => s.status === 'done').length;
  const canSplit = !readOnly && roleNames.length >= 2;

  return (
    <div className="mt-2 pt-2 border-t border-[#E9E5DA]">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[#5A574E]">分工</span>
          {list.length > 0 && (
            <span className="text-[10px] text-[#8B887E]">{doneCount}/{list.length} 完成</span>
          )}
        </div>
        <div className="flex gap-1">
          {canSplit && (
            <button
              type="button"
              onClick={splitByRole}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-[#C96442] text-[#C96442] hover:bg-[#F5E4DA] transition-colors"
              title="依負責人各建立一條子任務"
            >
              <Split size={11} strokeWidth={1.75} /> 拆分
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={() => addSubtask(roleNames[0] || '')}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-[#E9E5DA] text-[#5A574E] hover:border-[#C96442] hover:text-[#C96442] transition-colors"
            >
              <Plus size={11} strokeWidth={1.75} /> 子任務
            </button>
          )}
        </div>
      </div>

      {list.length > 0 && (
        <div className="h-1 bg-[#F1EEE6] rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-[#4F7E5C] transition-all duration-200"
            style={{ width: `${Math.round((doneCount / list.length) * 100)}%` }}
          />
        </div>
      )}

      <div className="space-y-1.5">
        {list.map(sub => {
          const editable = !readOnly && canEditSubtask(sub, sprint, planning, user);
          return (
            <div
              key={sub.id}
              className={`rounded-lg border p-2 ${editable ? 'bg-white border-[#E9E5DA]' : 'bg-[#F6F3EB] border-[#E9E5DA] opacity-70'}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <select
                  value={sub.assignee}
                  disabled={!editable}
                  onChange={e => {
                    const name = e.target.value;
                    const next = list.map(s => s.id === sub.id
                      ? { ...s, assignee: name, assigneeEmail: emailOf(name), updatedAt: Date.now() }
                      : s);
                    onChange(next);
                  }}
                  className="text-[10px] px-1.5 py-1 rounded border border-[#E9E5DA] bg-white text-[#5A574E] disabled:bg-transparent disabled:border-transparent"
                >
                  <option value="">(未指派)</option>
                  {(devMembers || []).map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
                <select
                  value={sub.status}
                  disabled={!editable}
                  onChange={e => patchStatus(sub.id, e.target.value)}
                  className={`text-[10px] px-1.5 py-1 rounded font-medium border-0 ${STATUS_STYLE[sub.status]} disabled:opacity-100`}
                >
                  {(Object.keys(STATUS_LABEL) as Subtask['status'][]).map(s => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={sub.time || ''}
                  disabled={!editable}
                  onChange={e => patchText(sub.id, 'time', e.target.value)}
                  placeholder="工時"
                  className="w-14 text-[10px] px-1.5 py-1 rounded border border-[#E9E5DA] text-[#8B887E] disabled:border-transparent disabled:bg-transparent"
                />
                {editable && (
                  <button
                    type="button"
                    onClick={() => removeSubtask(sub.id)}
                    className="ml-auto text-[#B5B2A6] hover:text-[#B8543C] p-1 rounded transition-colors"
                    title="刪除子任務"
                  >
                    <Trash2 size={12} strokeWidth={1.75} />
                  </button>
                )}
              </div>
              <input
                type="text"
                value={sub.title}
                disabled={!editable}
                onChange={e => patchText(sub.id, 'title', e.target.value)}
                placeholder="這位負責人負責的內容"
                className="w-full text-xs px-1.5 py-1 rounded border border-[#E9E5DA] text-[#1F1D17] placeholder-[#B5B2A6] disabled:border-transparent disabled:bg-transparent"
              />
              {!editable && (
                <div className="text-[10px] text-[#8B887E] mt-1">
                  {sub.assignee ? `僅 ${sub.assignee} 可編輯` : '僅專案擁有者可編輯'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2：驗證編譯**

```bash
npm run lint && npm run build
```

Expected: 通過。若 lucide-react 找不到 `Split`，改用 `GitBranch`（同套件皆有提供，擇一即可，後續 Task 沿用同一個）。

- [ ] **Step 3：Commit**

```bash
git add src/components/SubtaskList.tsx
git commit -m "feat: 新增子任務清單元件（拆分、進度、依負責人鎖定）"
```

---

### Task 6：把子任務接進 Backlog 兩套檢視

**Files:**
- Modify: `src/app/backlog/page.tsx`（桌機 `renderTasks()` `:457` 起、手機 PBI 分組檢視 `:893` 起）

**Interfaces:**
- Consumes: Task 5 的 `SubtaskList`、Task 4 的 `data.devMembers` / `data.planning` / `sprintOwnerId`
- Produces: 使用者可在 Backlog 直接拆分與編輯子任務

- [ ] **Step 1：加入 import 與 auth**

`src/app/backlog/page.tsx` 上方加入：

```ts
import SubtaskList from '@/components/SubtaskList';
import { useAuth } from '@/components/AuthProvider';
```

在元件內 state 區加入：

```ts
  const { user } = useAuth();
  // 子任務與附件都需要 sprintId；不可在 JSX 內直接讀 localStorage（會造成 hydration 不一致）
  const [currentSprintId, setCurrentSprintId] = useState('');
  useEffect(() => { setCurrentSprintId(localStorage.getItem('currentSprintId') || ''); }, []);
```

- [ ] **Step 2：新增子任務更新與完成確認的共用函式**

放在 `updateTask` 附近：

```ts
  const updateSubtasks = (taskId: string, next: Subtask[]) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: next } : t));
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
```

`setTimeout(..., 0)` 是必要的——`window.confirm` 會阻塞 render，直接在 onChange 內呼叫會讓子任務的狀態更新來不及畫上去。

- [ ] **Step 3：桌機看板卡片接入**

`src/app/backlog/page.tsx` 的 `renderTasks()` 內，非編輯狀態的區塊（`:590` 附近，`{task.role && ...}` 那個 `<div>` 之後、`</>` 之前）插入：

```tsx
              {task.type === 'task' && (
                <SubtaskList
                  subtasks={task.subtasks || []}
                  roleNames={parseRoleNames(task.role)}
                  devMembers={data.devMembers || []}
                  sprint={{ ownerId: sprintOwnerId }}
                  planning={data.planning}
                  user={user}
                  sprintId={currentSprintId}
                  currentUserEmail={user?.email || ''}
                  onChange={next => updateSubtasks(task.id, next)}
                  onAllDone={() => handleAllSubtasksDone(task.id)}
                />
              )}
```

**注意**：卡片有 `draggable`，子任務裡的 input 會被拖曳行為干擾。在包住 `SubtaskList` 的外層加上 `onDragStart` 攔截：

```tsx
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
                    onChange={next => updateSubtasks(task.id, next)}
                    onAllDone={() => handleAllSubtasksDone(task.id)}
                  />
                </div>
              )}
```

- [ ] **Step 4：手機 PBI 分組檢視接入**

同檔 `:995` 附近，非編輯狀態下顯示 `task.role` / `task.time` 標籤的那個 `<div>` 之後插入。此處卡片沒有 `draggable`，不需要 `onDragStart` 攔截：

```tsx
                                <SubtaskList
                                  subtasks={task.subtasks || []}
                                  roleNames={parseRoleNames(task.role)}
                                  devMembers={data.devMembers || []}
                                  sprint={{ ownerId: sprintOwnerId }}
                                  planning={data.planning}
                                  user={user}
                                  sprintId={currentSprintId}
                                  currentUserEmail={user?.email || ''}
                                  onChange={next => updateSubtasks(task.id, next)}
                                  onAllDone={() => handleAllSubtasksDone(task.id)}
                                />
```

- [ ] **Step 5：驗證**

```bash
npm run lint && npm run build
```

手動驗證：
1. Planning 建兩位成員（含 email），Backlog 建一張任務並勾選兩位負責人
2. 任務卡出現「拆分」按鈕，按下後產生兩條子任務，各自帶一位負責人
3. 兩條子任務都改成「完成」→ 跳出確認對話框；按確定後任務移到「完成」欄
4. 用**第二個 Google 帳號**（對應成員 B 的 email）登入，開同一個 Sprint：A 的子任務欄位為灰色唯讀並顯示「僅 A 可編輯」，B 的可編輯
5. 桌機看板拖曳任務卡仍正常，在子任務輸入框打字不會誤觸拖曳
6. 手機寬度（DevTools 切 375px）下 PBI 分組檢視同樣看得到子任務

- [ ] **Step 6：Commit**

```bash
git add src/app/backlog/page.tsx
git commit -m "feat: Backlog 桌機與手機檢視接入子任務分工"
```

---

### Task 7：檔案上傳 API `/api/upload`

**Files:**
- Create: `src/app/api/upload/route.ts`
- Modify: `package.json`（新增 `@vercel/blob` 相依）

**Interfaces:**
- Consumes: 無
- Produces:
  - `POST /api/upload`（multipart form，欄位 `file` 與 `sprintId`）→ `Attachment` JSON
  - `DELETE /api/upload`（JSON body `{ url }`）→ `{ ok: true }`

- [ ] **Step 1：安裝相依**

```bash
npm install @vercel/blob
```

- [ ] **Step 2：取得 Blob token**

此步驟需要在 Vercel Dashboard 操作，無法由指令完成：

1. Vercel Dashboard → 專案 `scrum-project` → Storage → Create Database → Blob
2. 建立後於 Settings → Environment Variables 確認出現 `BLOB_READ_WRITE_TOKEN`
3. 本機取得：`vercel env pull .env.local`

若 `.env.local` 沒有 `BLOB_READ_WRITE_TOKEN`，本機上傳會失敗並回 500，這是預期行為（API 會回中文錯誤訊息說明原因）。

- [ ] **Step 3：建立 `src/app/api/upload/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
]);

export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: '尚未設定 BLOB_READ_WRITE_TOKEN，請先在 Vercel 建立 Blob 儲存並執行 vercel env pull。' },
      { status: 500 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: '無法解析上傳內容。' }, { status: 400 });
  }

  const file = form.get('file');
  const sprintId = String(form.get('sprintId') || 'unknown');
  const uploadedBy = String(form.get('uploadedBy') || '');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '請選擇要上傳的檔案。' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: '檔案超過 10 MB 上限。' }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: `不支援的檔案類型：${file.type || '未知'}。僅接受圖片、PDF、Office 文件與 zip。` },
      { status: 400 }
    );
  }

  try {
    const safeName = file.name.replace(/[^\w.\-一-龥]/g, '_');
    const blob = await put(`scrum/${sprintId}/${safeName}`, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    return NextResponse.json({
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      url: blob.url,
      size: file.size,
      contentType: file.type,
      uploadedBy,
      uploadedAt: Date.now(),
    });
  } catch (err) {
    console.error('[upload] 失敗', err);
    return NextResponse.json({ error: '上傳失敗，請稍後再試。' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: '尚未設定 BLOB_READ_WRITE_TOKEN。' }, { status: 500 });
  }
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: '缺少要刪除的檔案網址。' }, { status: 400 });
    }
    await del(url);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[upload] 刪除失敗', err);
    return NextResponse.json({ error: '刪除失敗，請稍後再試。' }, { status: 500 });
  }
}
```

- [ ] **Step 4：驗證**

```bash
npm run lint && npm run build
```

手動驗證（需先完成 Step 2 的 token 設定）：

```bash
npm run dev
# 另開終端機
curl -F "file=@src/app/favicon.ico" -F "sprintId=test" http://localhost:3033/api/upload
```

Expected: 因 favicon 的 MIME 不在允許清單，回 400 與「不支援的檔案類型」訊息——這代表驗證邏輯有生效。改用一張 png 測試應回 200 與含 `url` 的 JSON。

- [ ] **Step 5：Commit**

```bash
git add package.json package-lock.json src/app/api/upload/route.ts
git commit -m "feat: 新增 Vercel Blob 檔案上傳 API"
```

---

### Task 8：附件元件 `AttachmentBox.tsx` 並接入三層

**Files:**
- Create: `src/components/AttachmentBox.tsx`
- Modify: `src/app/backlog/page.tsx`（PBI 卡、任務卡）、`src/components/SubtaskList.tsx`（子任務列）

**Interfaces:**
- Consumes: Task 1 的 `Attachment`、Task 7 的 `/api/upload`
- Produces: `AttachmentBox` 預設匯出

- [ ] **Step 1：建立 `src/components/AttachmentBox.tsx`**

```tsx
"use client";
import React, { useRef, useState } from 'react';
import { Paperclip, X, Loader2 } from 'lucide-react';
import type { Attachment, Subtask, Task } from '@/lib/taskTypes';

export interface AttachmentBoxProps {
  attachments: Attachment[];
  sprintId: string;
  uploadedBy: string;
  onChange: (next: Attachment[]) => void;
  readOnly?: boolean;
  /** 緊湊模式：用於子任務列，只顯示一行 */
  compact?: boolean;
}

const isImage = (t: string) => t.startsWith('image/');

const fmtSize = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export default function AttachmentBox({
  attachments, sprintId, uploadedBy, onChange, readOnly, compact,
}: AttachmentBoxProps) {
  const list = attachments || [];
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    const uploaded: Attachment[] = [];
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append('file', file);
      form.append('sprintId', sprintId || 'unknown');
      form.append('uploadedBy', uploadedBy || '');
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: form });
        const json = await res.json();
        if (!res.ok) {
          alert(json.error || '上傳失敗');
          continue;
        }
        uploaded.push(json as Attachment);
      } catch {
        alert(`「${file.name}」上傳失敗，請檢查網路連線。`);
      }
    }
    setBusy(false);
    if (uploaded.length > 0) onChange([...list, ...uploaded]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = async (att: Attachment) => {
    if (!window.confirm(`確定要刪除「${att.name}」嗎？`)) return;
    // 先更新畫面，Blob 端刪除失敗不阻擋使用者（孤兒檔案可容忍）
    onChange(list.filter(a => a.id !== att.id));
    try {
      await fetch('/api/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: att.url }),
      });
    } catch {}
  };

  if (readOnly && list.length === 0) return null;

  return (
    <div className={compact ? 'mt-1' : 'mt-2 pt-2 border-t border-[#E9E5DA]'}>
      <div className="flex items-center gap-2 mb-1">
        {!compact && <span className="text-[11px] font-medium text-[#5A574E]">附件</span>}
        {!readOnly && (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-[#E9E5DA] text-[#5A574E] hover:border-[#C96442] hover:text-[#C96442] transition-colors disabled:opacity-50"
          >
            {busy
              ? <><Loader2 size={11} strokeWidth={1.75} className="animate-spin" /> 上傳中</>
              : <><Paperclip size={11} strokeWidth={1.75} /> 上傳檔案</>}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => upload(e.target.files)}
        />
      </div>

      {list.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {list.map(att => (
            <div
              key={att.id}
              className="group/att relative flex items-center gap-1 bg-[#F6F3EB] border border-[#E9E5DA] rounded-md px-1.5 py-1"
            >
              {isImage(att.contentType) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={att.url} alt={att.name} className="w-8 h-8 object-cover rounded" />
              ) : (
                <Paperclip size={11} strokeWidth={1.75} className="text-[#8B887E]" />
              )}
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[#5A574E] hover:text-[#C96442] max-w-[110px] truncate"
                title={`${att.name}（${fmtSize(att.size)}）`}
              >
                {att.name}
              </a>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => remove(att)}
                  className="text-[#B5B2A6] hover:text-[#B8543C] p-0.5 rounded transition-colors"
                  title="刪除附件"
                >
                  <X size={11} strokeWidth={1.75} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!compact && !readOnly && (
        <div className="text-[10px] text-[#B5B2A6] mt-1">
          單檔上限 10 MB。附件連結為公開網址（不可猜測但無需登入即可開啟），請勿上傳機密資料。
        </div>
      )}
    </div>
  );
}
```

`next.config.mjs` 未設定 remote image domains，因此刻意使用原生 `<img>` 而非 `next/image`，並加上對應的 eslint 停用註解。

- [ ] **Step 2：子任務列接入附件**

`src/components/SubtaskList.tsx`：

在 import 區加入

```ts
import AttachmentBox from '@/components/AttachmentBox';
```

`sprintId` 與 `currentUserEmail` 兩個 props 已在 Task 5 定義好，此處直接使用。

在每條子任務的 `<input ... placeholder="這位負責人負責的內容" />` 之後插入：

```tsx
              <AttachmentBox
                attachments={sub.attachments || []}
                sprintId={sprintId}
                uploadedBy={currentUserEmail}
                readOnly={!editable}
                compact
                onChange={next => {
                  onChange(list.map(s => s.id === sub.id
                    ? { ...s, attachments: next, updatedAt: Date.now() }
                    : s));
                }}
              />
```

參數解構已在 Task 5 就位，不需再改。

- [ ] **Step 3：Backlog 提供 sprintId**

（此步驟其實已在 Task 6 Step 1 完成，此處僅確認。）在 `src/app/backlog/page.tsx` 的 state 區應已有：

```ts
  const [currentSprintId, setCurrentSprintId] = useState('');
  useEffect(() => { setCurrentSprintId(localStorage.getItem('currentSprintId') || ''); }, []);
```

不要在 JSX 內直接讀 `localStorage`——那會造成 SSR 與 client 首次 render 不一致的 hydration 警告。

- [ ] **Step 4：PBI 卡與任務卡接入附件**

`src/app/backlog/page.tsx`：

import 加入

```ts
import AttachmentBox from '@/components/AttachmentBox';
```

新增更新函式（放在 `updateSubtasks` 旁）：

```ts
  const updateAttachments = (taskId: string, next: Attachment[]) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, attachments: next } : t));
  };
```

在桌機 `renderTasks()` 的非編輯區塊中，`SubtaskList` 之後（PBI 與任務都要，所以放在 `task.type === 'task'` 判斷之外）插入：

```tsx
              <div onDragStart={e => e.stopPropagation()} draggable={false}>
                <AttachmentBox
                  attachments={task.attachments || []}
                  sprintId={currentSprintId}
                  uploadedBy={user?.email || ''}
                  onChange={next => updateAttachments(task.id, next)}
                />
              </div>
```

手機 PBI 分組檢視要處理兩處，都不需要 `onDragStart` 包裝。

PBI 標頭區塊（`:915` 附近，`{pbi.desc && <div ...>}` 之後）：

```tsx
                          <AttachmentBox
                            attachments={pbi.attachments || []}
                            sprintId={currentSprintId}
                            uploadedBy={user?.email || ''}
                            onChange={next => updateAttachments(pbi.id, next)}
                          />
```

任務卡非編輯區塊（緊接在 Task 6 Step 4 插入的 `<SubtaskList ... />` 之後）：

```tsx
                                <AttachmentBox
                                  attachments={task.attachments || []}
                                  sprintId={currentSprintId}
                                  uploadedBy={user?.email || ''}
                                  onChange={next => updateAttachments(task.id, next)}
                                />
```

- [ ] **Step 5：驗證**

```bash
npm run lint && npm run build
```

手動驗證：
1. 在 PBI、任務、子任務三處各上傳一張 png → 都出現縮圖
2. 上傳一個超過 10 MB 的檔案 → 出現「檔案超過 10 MB 上限」
3. 上傳 `.exe` 或其他不在清單的類型 → 出現「不支援的檔案類型」
4. 點縮圖旁的檔名 → 新分頁開啟該圖
5. 按 X 刪除 → 確認對話框後從畫面消失，重新整理後仍消失（代表有存進 Firestore）
6. 桌機看板拖曳任務卡仍正常

- [ ] **Step 6：Commit**

```bash
git add src/components/AttachmentBox.tsx src/components/SubtaskList.tsx src/app/backlog/page.tsx
git commit -m "feat: PBI／任務／子任務三層附件上傳"
```

---

### Task 9：跨 Sprint 聚合與寫回 `src/lib/myTasks.ts`

**Files:**
- Create: `src/lib/myTasks.ts`

**Interfaces:**
- Consumes: `fetchAccessibleSprints`（`src/lib/sprints.ts`）、Task 1 型別、Task 3 的 `normEmail`
- Produces:
  - `MyTaskItem`（型別）
  - `collectMyItems(sprints, email): MyTaskItem[]`
  - `updateSubtaskInSprint(sprintId, taskId, subtaskId, patch, actor): Promise<void>`
  - `updateTaskInSprint(sprintId, taskId, patch, actor): Promise<void>`

- [ ] **Step 1：建立 `src/lib/myTasks.ts`**

寫回刻意使用 `runTransaction` 而非 `setDoc merge`：`/my-tasks` 與 Backlog 頁可能同時開著，整包覆寫 `backlog.tasks` 會蓋掉別人同時的編輯。

```ts
// 跨 Sprint 的個人待辦聚合與寫回。
//
// 讀取：sprint 文件本身就含 backlog，fetchAccessibleSprints 一次 getDocs
// 即取得全部所需資料，不需要額外讀取。
//
// 寫回：/my-tasks 同時面對多個 Sprint，useAutoSave（綁定單一 sprintId）不適用。
// 改用 transaction 先讀最新 tasks 再只改目標項目，避免整包覆寫蓋掉他人編輯。

import { doc, runTransaction, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';
import type { Task, Subtask } from './taskTypes';
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
```

- [ ] **Step 2：驗證編譯**

```bash
npm run lint && npm run build
```

- [ ] **Step 3：Commit**

```bash
git add src/lib/myTasks.ts
git commit -m "feat: 跨 Sprint 個人待辦聚合與 transaction 寫回"
```

---

### Task 10：個人待辦頁 `/my-tasks`

**Files:**
- Create: `src/app/my-tasks/page.tsx`
- Modify: `src/components/Navigation.tsx:118-133`（頂部快捷列加入口）

**Interfaces:**
- Consumes: Task 9 的 `collectMyItems` / `updateSubtaskInSprint` / `updateTaskInSprint` / `isActiveSprint`、Task 8 的 `AttachmentBox`
- Produces: `/my-tasks` 路由

- [ ] **Step 1：建立 `src/app/my-tasks/page.tsx`**

```tsx
"use client";
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { BookOpen, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import AttachmentBox from '@/components/AttachmentBox';
import { fetchAccessibleSprints } from '@/lib/sprints';
import {
  collectMyItems, isActiveSprint, updateSubtaskInSprint, updateTaskInSprint,
  type SprintDoc, type MyTaskItem,
} from '@/lib/myTasks';
import type { Attachment, Subtask, Task } from '@/lib/taskTypes';

const STATUS_LABEL: Record<'todo' | 'doing' | 'done', string> = {
  todo: '待辦', doing: '進行中', done: '完成',
};
const STATUS_STYLE: Record<'todo' | 'doing' | 'done', string> = {
  todo: 'bg-[#F0DDD3] text-[#B8543C]',
  doing: 'bg-[#F0E4C9] text-[#B8893A]',
  done: 'bg-[#DDE6D9] text-[#4F7E5C]',
};

export default function MyTasks() {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [sprints, setSprints] = useState<SprintDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'doing' | 'done'>('all');
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const list = await fetchAccessibleSprints<SprintDoc>({ uid: user.uid, email: user.email });
      setSprints(list);
    } catch (err) {
      console.error('[my-tasks] 載入失敗', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  const visibleSprints = includeCompleted ? sprints : sprints.filter(isActiveSprint);
  const items = collectMyItems(visibleSprints, user?.email)
    .filter(it => statusFilter === 'all' || it.status === statusFilter);

  const grouped = items.reduce<Record<string, MyTaskItem[]>>((acc, it) => {
    (acc[it.sprintId] = acc[it.sprintId] || []).push(it);
    return acc;
  }, {});

  const keyOf = (it: MyTaskItem) => `${it.sprintId}:${it.task.id}:${it.subtask?.id || 'task'}`;

  const applyLocal = (it: MyTaskItem, patch: { status?: MyTaskItem['status']; title?: string; attachments?: Attachment[] }) => {
    setSprints(prev => prev.map(s => {
      if (s.id !== it.sprintId) return s;
      const tasks = (s.backlog?.tasks || []).map(t => {
        if (t.id !== it.task.id) return t;
        if (!it.subtask) return { ...t, ...patch };
        return {
          ...t,
          subtasks: (t.subtasks || []).map(sub => sub.id === it.subtask!.id ? { ...sub, ...patch } : sub),
        };
      });
      return { ...s, backlog: { ...s.backlog, tasks } };
    }));
  };

  // 型別必須是 Partial<Subtask> & Partial<Task>，不能用 Record<string, unknown>
  // ——後者無法指派給 updateSubtaskInSprint 的 Partial<Subtask> 參數，會編譯失敗。
  const persist = async (it: MyTaskItem, patch: Partial<Subtask> & Partial<Task>) => {
    if (!user) return;
    const k = keyOf(it);
    setSaving(k);
    const actor = { email: user.email, displayName: user.displayName };
    try {
      if (it.subtask) {
        await updateSubtaskInSprint(it.sprintId, it.task.id, it.subtask.id, patch, actor);
      } else {
        await updateTaskInSprint(it.sprintId, it.task.id, patch, actor);
      }
    } catch (err) {
      console.error('[my-tasks] 儲存失敗', err);
      alert('儲存失敗，請重新整理後再試。');
      await load();
    } finally {
      setSaving(null);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-[#F6F3EB] flex items-center justify-center text-[#8B887E]">載入中…</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F6F3EB] flex flex-col items-center justify-center gap-4">
        <div className="text-[#5A574E]">請先登入才能看到指派給你的工作。</div>
        <button
          onClick={signInWithGoogle}
          className="bg-[#1F1D17] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#5A574E] transition-colors"
        >
          使用 Google 登入
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F3EB] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E9E5DA] text-[#5A574E] rounded-lg text-sm hover:shadow-sm transition-all"
          >
            <BookOpen size={15} strokeWidth={1.75} />
            回到專案大廳
          </Link>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E9E5DA] text-[#5A574E] rounded-lg text-sm hover:shadow-sm transition-all"
          >
            <RefreshCw size={14} strokeWidth={1.75} />
            重新整理
          </button>
        </div>

        <h1 className="text-xl font-semibold text-[#1F1D17] mb-1">我的工作</h1>
        <div className="text-sm text-[#8B887E] mb-4">
          {user.displayName || user.email}　共 {items.length} 項
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(['all', 'todo', 'doing', 'done'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                statusFilter === s
                  ? 'bg-[#1F1D17] text-white border-[#1F1D17]'
                  : 'bg-white text-[#5A574E] border-[#E9E5DA] hover:border-[#C96442]'
              }`}
            >
              {s === 'all' ? '全部' : STATUS_LABEL[s]}
            </button>
          ))}
          <label className="flex items-center gap-1.5 text-xs text-[#5A574E] ml-auto cursor-pointer">
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={e => setIncludeCompleted(e.target.checked)}
            />
            含已結束的專案
          </label>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-[#8B887E] text-sm py-8 justify-center">
            <Loader2 size={16} className="animate-spin" /> 載入中…
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-[#E9E5DA] rounded-xl p-8 text-center text-sm text-[#8B887E]">
            目前沒有指派給你的工作。<br />
            <span className="text-xs">
              請確認專案的 Sprint Planning 成員表已填入你的 Email（{user.email}），且任務已拆分出你的子任務。
            </span>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([sprintId, list]) => (
              <div key={sprintId}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-[#1F1D17]">{list[0].sprintName}</div>
                  <Link
                    href={`/backlog?sprint=${sprintId}`}
                    className="text-xs text-[#8B887E] hover:text-[#C96442]"
                  >
                    開啟看板 →
                  </Link>
                </div>
                <div className="space-y-2">
                  {list.map(it => {
                    const k = keyOf(it);
                    return (
                      <div key={k} className="bg-white border border-[#E9E5DA] rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <select
                            value={it.status}
                            onChange={e => {
                              const status = e.target.value as MyTaskItem['status'];
                              applyLocal(it, { status });
                              persist(it, { status });
                            }}
                            className={`text-[10px] font-medium px-1.5 py-1 rounded border-0 ${STATUS_STYLE[it.status]}`}
                          >
                            {(['todo', 'doing', 'done'] as const).map(s => (
                              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                            ))}
                          </select>
                          <span className="text-[10px] text-[#8B887E] bg-[#F6F3EB] px-1.5 py-0.5 rounded">
                            {it.subtask ? `子任務 · ${it.task.title}` : '任務'}
                          </span>
                          {saving === k && <Loader2 size={12} className="animate-spin text-[#8B887E]" />}
                        </div>
                        <input
                          type="text"
                          value={it.title}
                          onChange={e => applyLocal(it, { title: e.target.value })}
                          onBlur={e => persist(it, { title: e.target.value })}
                          className="w-full text-sm text-[#1F1D17] px-2 py-1.5 border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA]"
                          placeholder="我負責的內容"
                        />
                        <AttachmentBox
                          attachments={(it.subtask ? it.subtask.attachments : it.task.attachments) || []}
                          sprintId={it.sprintId}
                          uploadedBy={user.email || ''}
                          onChange={next => {
                            applyLocal(it, { attachments: next });
                            persist(it, { attachments: next });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2：Navigation 加入口**

`src/components/Navigation.tsx:118` 附近，「知識學習」的 `<Link>` 之後、版本號 `<span>` 之前插入：

```tsx
          <Link
            href="/my-tasks"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E9E5DA] text-[#5A574E] rounded-lg text-sm hover:shadow-sm hover:-translate-y-[1px] transition-all duration-150 whitespace-nowrap"
          >
            <ListChecks size={15} strokeWidth={1.75} />
            我的工作
          </Link>
```

`:9` 的 lucide-react import 補上 `ListChecks`：

```ts
import { BookOpen, Brain, ClipboardList, Check, Eye, Pencil, X, ListChecks } from 'lucide-react';
```

- [ ] **Step 3：驗證**

```bash
npm run lint && npm run build
```

手動驗證：
1. 用成員 B 的 Google 帳號登入，開 `/my-tasks`
2. 看得到跨多個 Sprint 指派給 B 的子任務，依專案分組
3. 改某項狀態 → 切到該 Sprint 的 `/backlog`，該子任務狀態同步
4. 勾「含已結束的專案」→ 已結束 Sprint 的項目出現
5. 在 `/my-tasks` 上傳一張圖 → 回 Backlog 看得到同一張圖
6. **併發驗證**：兩個瀏覽器分頁，一個開 `/my-tasks` 改子任務 X，另一個開 `/backlog` 改子任務 Y，重新整理後兩邊修改都在（transaction 有生效）

- [ ] **Step 4：Commit**

```bash
git add src/app/my-tasks/page.tsx src/components/Navigation.tsx
git commit -m "feat: 新增跨 Sprint 個人待辦頁 /my-tasks"
```

---

### Task 11：版本號與部署

**Files:**
- Modify: `package.json:3`、`src/components/Navigation.tsx:134`

- [ ] **Step 1：確認前面所有改動都已 commit**

```bash
git status --short
```

Expected: 無未提交的改動（若仍有 v1.0.249 那批既有 WIP，先詢問使用者要不要一起處理，不要擅自 commit）。

- [ ] **Step 2：bump 版本號**

`package.json` 的 `"version"` 與 `src/components/Navigation.tsx:134` 的 `v1.0.249` 必須同步改成新版本（例：`1.0.250`）。兩處不一致會導致 UI 顯示舊版號。

- [ ] **Step 3：本機驗證**

```bash
npm run lint && npm run build
```

重啟本機 server 才會反映新版號：

```bash
npm run dev
```

開 `http://localhost:3033/backlog`，確認導覽列右上角版本號已更新。

- [ ] **Step 4：Commit 並部署**

```bash
git add package.json src/components/Navigation.tsx
git commit -m "chore: bump 版本號至 v1.0.250"
vercel --prod
```

- [ ] **Step 5：線上驗證**

在部署完成的正式網址上，重跑 Task 6、8、10 的手動驗證重點：拆分子任務、上傳附件、`/my-tasks` 跨 Sprint 顯示。使用者只在線上網址測試，只驗證本機會被誤判成沒生效。

---

## 風險與注意事項

- **`BLOB_READ_WRITE_TOKEN` 需人工在 Vercel Dashboard 建立 Blob 儲存**（Task 7 Step 2）。這步無法由指令完成，卡住時要主動告知使用者。
- **Vercel Blob 的 URL 為公開存取**——不可猜測但無需登入即可開啟。UI 已加提示文字，但這個限制無法從程式面消除。
- **`backlog.devsList`（`string[]`）與 `planning.devsList`（物件陣列）同名不同型別**。改動任一處時務必確認自己動的是哪一個。
- **backlog 兩套渲染**（桌機看板、手機 PBI 分組）必須同步改，只改一邊會造成手機看不到子任務。
- **子任務在桌機看板內的輸入框會與卡片 `draggable` 衝突**，必須用 `onDragStart={e => e.stopPropagation()}` 包住。
- **`window.confirm` 需包在 `setTimeout(..., 0)` 內**，否則會阻塞 React render，子任務狀態來不及畫上去。
- 成員未填 email 時，其子任務的 `assigneeEmail` 為空字串，該子任務只有 Sprint 擁有者／PO／SM 能編輯。這是預期行為，UI 會顯示「僅專案擁有者可編輯」。
