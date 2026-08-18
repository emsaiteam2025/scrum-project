# Sprint Backlog 專案管理化：子任務、個人待辦、成員身分、附件

日期：2026-08-18

## 問題

Sprint Backlog 目前是一塊「團隊共用的看板」，缺少專案管理系統該有的四件事：

1. **多負責人無法拆分** — `Task.role` 是一個逗號分隔字串（`"小明, 小華"`），兩個人掛在同一張卡上，但誰負責哪一段、各自做到哪裡，系統完全不知道。
2. **沒有個人視角** — 只能一個 Sprint 一個 Sprint 打開看板，開發者無從得知「所有指派給我的工作」是什麼。
3. **登入帳號與開發者是斷開的** — `AuthProvider` 認的是 Google 帳號（uid / email），Planning 的 `devsList` 存的是純姓名字串，兩者沒有任何對應關係。因此系統無法判斷「登入的這個人是誰的工作」。
4. **無法上傳檔案** — 專案完全沒有上傳功能，Firebase Storage 也未啟用。成果截圖、規格書只能貼在描述文字裡。

## 目標

讓每一位開發人員登入後，能看到並編輯屬於自己的工作，包含在共同任務中切分出自己負責的部分，並為工作附上檔案與圖片。

## 範圍決定（已與使用者確認）

| 決定 | 選擇 |
|---|---|
| 身分綁定 | Planning 成員表加 `email` 欄位 |
| 拆分模型 | 子任務層（PBI → Task → Subtask 三層） |
| 個人待辦 | 跨 Sprint 的獨立頁面 `/my-tasks` |
| 權限強度 | UI 鎖定 + `editHistory` 留痕，**不動 Firestore 儲存結構** |
| 鎖定範圍 | 只鎖子任務；任務／PBI 層維持現行協作者皆可編輯 |
| 狀態連動 | 子任務全完成時**跳確認**，由人決定是否標記父任務完成 |
| 掃描範圍 | `/my-tasks` 預設只掃進行中＋待開始的 Sprint，另有「含已結束」切換 |
| 檔案儲存 | Vercel Blob |
| 附件層級 | 子任務、任務、PBI 三層皆可 |

### 明確不做

- 不把子任務搬到 Firestore 子集合（權限採 UI 鎖定，不需要後端強制）
- 不改動現有 `useAutoSave` 的儲存契約
- 不移除或改寫既有的 `Task.role` 字串（看板、`/workload`、`/report` 都在用）

## 設計

### 1. 資料模型

#### Planning：`src/app/planning/page.tsx`

```ts
devsList: { id: string; name: string; role: string; email: string }[]
```

`email` 為新增欄位，選填。舊資料 `email` 為 `undefined`，該成員就只是無法被身分比對，其餘功能不受影響。

填入 email 時，同步把該 email（小寫）加進 Sprint 的 `collaborators`（role `editor`）與 `collaboratorEmails`，讓「邀請協作」與「指定身分」在同一個動作完成。這段沿用 `src/app/page.tsx` 分享 Modal 既有的寫法。

#### Backlog：`src/app/backlog/page.tsx`

```ts
interface Attachment {
  id: string;
  name: string;
  url: string;            // Vercel Blob URL
  size: number;
  contentType: string;
  uploadedBy: string;     // email
  uploadedAt: number;
}

interface Subtask {
  id: string;
  title: string;          // 這位負責人負責的內容
  desc?: string;
  assignee: string;       // dev name，單一負責人
  assigneeEmail?: string; // 權限判斷依據
  status: 'todo' | 'doing' | 'done';
  time?: string;
  attachments?: Attachment[];
  updatedAt?: number;
}

interface Task {
  // ...現有欄位不變
  subtasks?: Subtask[];
  attachments?: Attachment[];
}
```

`Task` 同時代表 PBI（`type: 'pbi'`）與任務（`type: 'task'`），因此 `attachments` 一個欄位即涵蓋 PBI 與任務兩層。

儲存位置不變：仍在 `sprints/{sprintId}.backlog.tasks[]` 之內，`useAutoSave('backlog')` 無須修改。

### 2. 拆分動作

任務卡新增「拆分」按鈕，當 `task.role` 解析出 2 位以上成員時才顯示。

點擊後：

1. 以 `/[,、，\n]/` 拆解 `task.role`（與 `src/app/backlog/page.tsx:123` 現有寫法一致）
2. 每位成員產生一條 `Subtask`：`title` 空白、`assignee` 為該姓名、`assigneeEmail` 由 `devsList` 查得、`status: 'todo'`
3. 已存在相同 `assignee` 的子任務則跳過，不重複產生
4. `task.role` 原樣保留

使用者再逐條填寫各自負責的內容。除了拆分按鈕，任何任務都可以手動新增子任務。

### 3. 狀態連動

任務卡顯示子任務進度（例：`1/2 完成`）。

當最後一條子任務被標記 `done` 且父任務尚非 `done` 時，跳出確認對話框：「全部子任務已完成，要把這張任務標為完成嗎？」使用者確認才改動父任務狀態。取消則不再對同一次事件重複詢問。

不做反向自動連動（子任務回退不會自動把父任務拉回）。

### 4. 權限：`src/lib/permissions.ts`（新檔）

```ts
interface SprintMember { name: string; role: string; email: string; }

// 由 planning.devsList 以 user.email 比對出「我是誰」
useSprintMember(planning, user): SprintMember | null

// 全權編輯：Sprint 擁有者，或我的姓名等於 planning.po / planning.sm
isSprintAdmin(sprint, planning, user): boolean

// 子任務可否編輯
canEditSubtask(subtask, sprint, planning, user): boolean
```

`planning.po` 與 `planning.sm` 存的是**姓名字串**而非 email，因此 admin 判斷分兩步：先用 email 從 `devsList` 比對出我的 `name`，再看該 `name` 是否等於 `planning.po` 或 `planning.sm`（去除前後空白後比對）。

比對一律 email 小寫正規化（與 `src/app/page.tsx` 既有的 `collaboratorEmails` 修復邏輯一致）。

非本人的子任務：輸入欄位 `disabled`、卡片灰化、顯示「僅 {負責人} 可編輯」。

任務／PBI 層不鎖，維持現行行為。所有寫入照舊記入 `editHistory`。

### 5. 個人待辦：`src/app/my-tasks/page.tsx`（新頁）

#### 讀取

沿用 `fetchAccessibleSprints()`（`src/lib/sprints.ts`）。因為 backlog 資料就存在 Sprint 文件本身，一次 `getDocs` 即取得全部所需資料，**不需要額外讀取**。

預設只保留 `sprintStatus` 為 `'in-progress'` 或 `'pending'` 的 Sprint（欄位不存在時視為 `'pending'` 納入；不沿用大廳那套依任務數推算的 `auto` 判斷，因為 `/my-tasks` 沒有 dashboard 統計資料）。提供「含已結束」切換以納入 `'completed'`。

前端展開所有 `tasks[].subtasks[]`，取 `assigneeEmail === user.email` 者；另外納入 `task.role` 只有一人且該人是我、且沒有子任務的任務（單人任務不需要拆分也應該出現在我的待辦）。

#### 顯示

依 Sprint 分組，狀態（待辦／進行中／完成）篩選。卡片上可直接改狀態、改內容、填工時、上傳附件。每張卡有連結可跳回該 Sprint 的 Backlog。

#### 寫回：`src/lib/myTasks.ts`（新檔）

`/my-tasks` 同時面對多個 Sprint，`useAutoSave` 綁定單一 `sprintId`，不適用。

改用 Firestore `runTransaction`：讀取該 Sprint 最新的 `backlog.tasks` → 只修改目標子任務 → 寫回。這避免了「整包覆寫」蓋掉其他人同時編輯的問題。

同時寫入 `editHistory`，格式與 `useAutoSave` 產生的一致。

#### 導覽

`src/components/Navigation.tsx` 新增「我的工作」入口。

### 6. 檔案上傳（Vercel Blob）

#### 後端：`src/app/api/upload/route.ts`（新檔）

- `POST` — `@vercel/blob` 的 `put()`，回傳 `Attachment` 物件
- `DELETE` — `del()`

需要環境變數 `BLOB_READ_WRITE_TOKEN`，本機以 `vercel env pull` 取得。

限制：

- 單檔 10 MB
- 允許類型：圖片（png/jpeg/gif/webp）、pdf、Office 文件、zip
- 超出限制回 400 並附中文訊息

#### 前端：`src/components/AttachmentBox.tsx`（新檔）

拖放上傳、上傳進度、圖片縮圖預覽、下載連結、刪除。唯讀模式下只顯示不可操作。

掛載於三處：PBI 卡、任務卡、子任務列。

#### 安全性

Vercel Blob 的 URL 為公開存取（不可猜測，但無需登入即可開啟）。這適用於內部團隊文件，不適合放機密資料。此限制需在 UI 上以提示文字說明。

### 7. 檔案結構整理

`src/app/backlog/page.tsx` 已達 1316 行。本次新增功能不再堆入該檔，改為抽出元件：

| 新檔 | 用途 |
|---|---|
| `src/components/SubtaskList.tsx` | 子任務清單與編輯 |
| `src/components/AttachmentBox.tsx` | 附件上傳／預覽／刪除 |
| `src/lib/permissions.ts` | 成員身分比對與編輯權限判斷 |
| `src/lib/myTasks.ts` | 跨 Sprint 聚合與 transaction 寫回 |
| `src/app/my-tasks/page.tsx` | 個人待辦頁 |
| `src/app/api/upload/route.ts` | Vercel Blob 上傳／刪除 |

不進行與本需求無關的重構。

## 實作順序

四項功能彼此有依賴，依此順序推進，每一階段都可獨立驗證：

1. **身分基礎** — Planning 加 `email` 欄位＋同步 collaborators；`src/lib/permissions.ts`
2. **子任務** — 型別、`SubtaskList.tsx`、拆分按鈕、進度與完成確認、UI 鎖定
3. **附件** — `/api/upload`、`AttachmentBox.tsx`，掛上 PBI／任務／子任務三層
4. **個人待辦** — `src/lib/myTasks.ts`、`/my-tasks` 頁、Navigation 入口

## 相容性

- 既有 Sprint 沒有 `subtasks` / `attachments` / `devsList[].email`，全部視為 `undefined` 並正常運作
- `Task.role` 不變，`/workload`、`/report`、`/daily-scrum` 的既有統計不受影響
- Firestore 規則不需修改（沿用現行「登入即可讀寫」）

## 驗證方式

- 兩人共掛的任務按「拆分」後產生兩條子任務，各自 `assigneeEmail` 正確
- 以開發者 A 的帳號登入，B 的子任務為唯讀、A 的可編輯
- `/my-tasks` 列出跨 Sprint 指派給登入者的項目；在該頁改狀態後，回 Backlog 頁看得到同樣結果
- 兩個瀏覽器同時編輯同一 Sprint 的不同子任務，兩邊的修改都不會遺失
- 上傳圖片後於 PBI／任務／子任務三層都能預覽與刪除
- 超過 10 MB 或不允許的類型會被擋下並顯示訊息

## 版本

實作完成後 bump 版本號（`package.json` 與 `src/components/Navigation.tsx` 需同步），並以 `vercel --prod` 部署。
