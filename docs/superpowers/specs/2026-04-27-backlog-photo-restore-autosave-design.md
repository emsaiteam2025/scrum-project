# Backlog 照片還原 & 自動儲存修復 設計文件

**日期**: 2026-04-27  
**狀態**: 待實作

---

## 背景

使用者的 Backlog 任務看板資料在遷移至 Vercel 後意外消失，需要兩個功能：
1. 能上傳任務看板照片，透過 AI 解析並完整還原任務資料
2. 確保 Backlog 自動儲存可靠，不再有資料消失的疑慮

---

## 功能一：照片還原 Backlog

### 流程

1. 使用者在 Backlog 頁頂部點擊「📸 從照片還原」按鈕
2. 選擇本地圖片（JPG/PNG）
3. 圖片轉 base64，送到 `/api/ai-restore-backlog` API route
4. API 用現有欄位的 Gemini API Key 呼叫 Gemini Vision（`gemini-1.5-flash`）
5. Prompt 要求 Gemini 回傳 JSON 格式的任務清單，包含 PBI 與 Tasks
6. 解析 JSON → 完整取代 `data.tasks`（原資料清空）
7. 觸發 `forceSave()` 立即儲存到 Firebase
8. 還原後設定一個 `photoRestoredAt` 時間戳，讓 5 秒 PBI 同步邏輯在 15 秒內跳過，避免剛還原的資料被覆蓋

### API Route：`/api/ai-restore-backlog`

- **方法**: POST
- **輸入**: `{ imageBase64: string, mimeType: string, apiKey: string }`
- **輸出**: `{ tasks: Task[] }`
- **Gemini Prompt 要點**:
  - 解析看板照片中的所有 PBI 和任務卡片
  - 識別各卡片的狀態欄位（pbi / todo / doing / done / accepted）
  - 回傳 JSON 陣列，格式符合 Task interface

### Task interface（現有）

```typescript
interface Task {
  id: string;        // 新產生的 UUID
  type: 'pbi' | 'task';
  status: 'pbi' | 'todo' | 'doing' | 'done' | 'accepted';
  title: string;
  desc?: string;
  role?: string;
  time?: string;
  pbiId?: string;    // task 的歸屬 PBI id
}
```

### UI 細節

- 按鈕位置：Backlog 頁頂部工具列（API Key 輸入區附近）
- 解析中顯示 loading 狀態（「🔍 AI 正在解析照片...」）
- 解析失敗顯示 alert 錯誤訊息
- 還原成功顯示簡短成功提示

---

## 功能二：自動儲存可靠性修復

### 問題點

1. **SaveIndicator 缺失**：Backlog 頁面沒有 `SaveIndicator`，使用者看不到儲存狀態，不知道資料是否已儲存
2. **5 秒 Planning 同步覆蓋風險**：每 5 秒的 `syncWhatsFromPlanning` 會根據 Planning WHAT 的 ID 清單過濾 PBI，若照片還原後的 PBI ID 不在 Planning 清單中，5 秒內即被刪除

### 修復方案

**修復 1：新增 SaveIndicator**
- 在 Backlog 頁頂部（Navigation 旁）加入 `<SaveIndicator status={saveStatus} />`
- `saveStatus` 已由 `useAutoSave` 回傳，只需傳入即可

**修復 2：照片還原後暫停 PBI 同步**
- 在 Backlog 組件加一個 `useRef<number>(0)` 叫 `photoRestoredAt`
- 照片還原完成時記錄 `Date.now()`
- `syncWhatsFromPlanning` 開頭檢查：若距上次還原不足 15000ms，直接 return，跳過本次同步

---

## 不在本次範圍內

- 照片還原前的資料預覽（使用者選擇直接取代）
- 多張照片合併還原
- 自動定期備份功能

---

## 檔案異動清單

| 檔案 | 異動內容 |
|------|----------|
| `src/app/backlog/page.tsx` | 加照片上傳按鈕、SaveIndicator、photoRestoredAt ref、同步保護 |
| `src/app/api/ai-restore-backlog/route.ts` | 新增 API route，呼叫 Gemini Vision |
