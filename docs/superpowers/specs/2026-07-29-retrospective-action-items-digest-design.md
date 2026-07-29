# 歷次改善行動彙總（Retrospective Action Items Digest）

日期：2026-07-29

## 問題

每個 Sprint 的 Retrospective 都會填「挑戰最大效益來改」（`retrospective.actionItems`，一個自由文字欄），但這些內容目前分散在各自的 Sprint 裡：

- Retrospective 頁面只看得到當前 Sprint 自己的內容
- 成效報告雖然有顯示（`src/app/report/page.tsx:1372`），但埋在每個 Sprint 的展開列裡，管理者要逐一展開才看得完

結果是沒有人看得到「這個團隊歷來到底提出過哪些改善行動」。

## 目標

把所有 Sprint 的改善行動彙整成一份唯讀清單，同時放在 Retrospective 頁面與成效報告，讓管理者一眼掌握全貌。

## 範圍決定（已與使用者確認）

- **唯讀彙總**：只呈現既有文字，不追蹤每條行動的落實狀態，不新增任何 Firestore 欄位
- **資料範圍**：使用者擁有的 Sprint ＋ 使用者是協作者的 Sprint

## 設計

### 1. 資料層：`src/lib/sprints.ts`（新檔）

`fetchAccessibleSprints<T>(user)`：合併「擁有的」與「協作的」兩個查詢、依 id 去重、依 `createdAt` 由舊到新排序。

查詢方式沿用 `src/app/workload/page.tsx` 已驗證可行的寫法：

```ts
where('ownerId', '==', user.uid)
where('collaboratorEmails', 'array-contains', user.email)
```

兩個查詢各自 try/catch，其中一個因權限失敗不會讓另一個一起沒資料。

抽出這個函式的另一個效益：`/workload` 與 `/report` 目前各有一份重複的查詢邏輯。

### 2. 顯示元件：`src/components/ActionItemsDigest.tsx`（新檔）

唯讀元件，兩個頁面共用，確保呈現一致。

- Props：`sprints`、`currentSprintId?`（用來標「本次」）
- 依日期**新到舊**排列；`actionItems` 空白的 Sprint 自動略過
- 每個 Sprint 一塊：名稱＋日期，內文逐行拆成條列
- 已經有 `-`／`•`／`1.` 等標記開頭的行會去掉原標記，避免雙重項目符號
- 日期優先用 `planning.startDate` 字串直接格式化（不經過 `Date`，避免時區位移），沒有才退回 `createdAt`

### 3. 放置位置

- **Retrospective 頁面**：「下一個 Sprint 行動進度追蹤人」下方。該頁本來就有 `previousActions`（上次行動）需要手動抄寫，彙總可直接對照。
- **成效報告**：圖表區之後、逐一 Sprint 清單之前。同時把該頁的查詢換成 `fetchAccessibleSprints`，補上目前漏掉的協作專案。

## 已知連帶影響

成效報告的資料來源從「只有自己擁有的」擴大為「擁有的＋協作的」，Sprint 數量會變多，因此完成率、趨勢圖等統計數字會跟著變動。這是範圍決定所預期的結果。

## 不做

- 不解析文字成結構化項目、不做完成狀態勾選
- 不做 AI 歸納
- 不改動任何既有 Firestore 欄位
