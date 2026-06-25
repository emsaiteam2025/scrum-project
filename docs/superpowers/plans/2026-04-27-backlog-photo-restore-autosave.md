# Backlog 照片還原 & 自動儲存修復 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Backlog 頁面加入「從照片還原」功能（Gemini Vision 解析），並修復 SaveIndicator 缺失與 Planning 同步覆蓋問題。

**Architecture:** 新增 `/api/ai-restore-backlog` API route 呼叫 Gemini Vision multimodal API 解析照片並回傳 Task[]；在 backlog/page.tsx 加入上傳按鈕、SaveIndicator、photoRestoredAt ref 與同步保護邏輯。

**Tech Stack:** Next.js 14 App Router, TypeScript, Gemini Vision API (`gemini-1.5-flash`), Firebase Firestore

---

## 檔案清單

| 動作 | 路徑 |
|------|------|
| 新增 | `src/app/api/ai-restore-backlog/route.ts` |
| 修改 | `src/app/backlog/page.tsx` |

---

### Task 1：新增 Gemini Vision API Route

**Files:**
- Create: `src/app/api/ai-restore-backlog/route.ts`

- [ ] **Step 1：建立 API route 檔案**

建立 `src/app/api/ai-restore-backlog/route.ts`，內容如下：

```typescript
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType, apiKey } = await req.json();

    if (!apiKey || !imageBase64) {
      return NextResponse.json({ error: '缺少 apiKey 或 imageBase64' }, { status: 400 });
    }

    if (!apiKey.startsWith('AIza')) {
      return NextResponse.json({ error: '照片還原功能需要 Gemini API Key（以 AIza 開頭）' }, { status: 400 });
    }

    const prompt = `你是一個 Scrum 任務看板分析專家。請仔細分析這張任務看板的照片，辨識出所有的 PBI（產品待辦項目）和任務卡片。

請回傳一個 JSON 陣列，格式如下（只回傳 JSON，不要有任何說明文字或 Markdown）：
[
  {
    "id": "photo-pbi-1",
    "type": "pbi",
    "status": "pbi",
    "title": "PBI 標題",
    "desc": "描述（若有）"
  },
  {
    "id": "photo-task-1",
    "type": "task",
    "status": "todo",
    "title": "任務標題",
    "desc": "描述（若有）",
    "role": "負責人（若有）",
    "time": "預估工時（若有）"
  }
]

規則：
- type 只能是 "pbi" 或 "task"
- PBI 的 status 固定為 "pbi"
- task 的 status 依看板欄位判斷：todo（待辦）、doing（進行中）、done（完成）、accepted（已驗收）
- id 請用 "photo-pbi-1", "photo-pbi-2"... 和 "photo-task-1", "photo-task-2"... 依序命名
- 若無法辨識某欄位，用空字串 ""
- 若看板中無任何任務，回傳空陣列 []`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } },
              { text: prompt }
            ]
          }],
          generationConfig: { temperature: 0.1 }
        })
      }
    );

    if (!response.ok) {
      let errMessage = response.statusText;
      try {
        const err = await response.json();
        errMessage = err?.error?.message || errMessage;
      } catch {}
      throw new Error(errMessage);
    }

    const data = await response.json();
    let aiContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    aiContent = aiContent.trim();

    // 擷取 JSON 陣列
    const startIdx = aiContent.indexOf('[');
    const endIdx = aiContent.lastIndexOf(']');
    if (startIdx !== -1 && endIdx !== -1) {
      aiContent = aiContent.substring(startIdx, endIdx + 1);
    }

    let tasks = [];
    try {
      tasks = JSON.parse(aiContent);
    } catch {
      throw new Error('Gemini 回傳格式無法解析，請重試');
    }

    return NextResponse.json({ tasks });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('ai-restore-backlog Error:', error);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 2：確認檔案建立正確**

```bash
cat /Users/ems-tainan/ClaudeCode/scrum-project/src/app/api/ai-restore-backlog/route.ts | head -5
```

預期輸出前幾行包含 `import { NextResponse }` 和 `export async function POST`。

- [ ] **Step 3：Commit**

```bash
cd /Users/ems-tainan/ClaudeCode/scrum-project
git add src/app/api/ai-restore-backlog/route.ts
git commit -m "feat: add ai-restore-backlog API route using Gemini Vision"
```

---

### Task 2：修改 backlog/page.tsx — 加入 saveStatus、photoRestoredAt ref、同步保護

**Files:**
- Modify: `src/app/backlog/page.tsx`

- [ ] **Step 1：在 useAutoSave 解構中加入 saveStatus**

找到這行（約第 26 行）：
```typescript
  const { data, updateData, loading, forceSave } = useAutoSave('backlog', {
```

改為：
```typescript
  const { data, updateData, loading, forceSave, saveStatus } = useAutoSave('backlog', {
```

- [ ] **Step 2：在組件頂部加入 photoRestoredAt ref 和 isPhotoRestoring state**

找到這行（約第 24 行）：
```typescript
  const [isAiLoading, setIsAiLoading] = useState(false);
```

在它下方加入：
```typescript
  const [isPhotoRestoring, setIsPhotoRestoring] = useState(false);
  const photoRestoredAt = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 3：修改 syncWhatsFromPlanning 加入保護**

找到 `syncWhatsFromPlanning` 函式開頭（約第 53 行）：
```typescript
    const syncWhatsFromPlanning = async () => {
      try {
        const sprintId = localStorage.getItem('currentSprintId');
```

在 `try {` 的下一行（`const sprintId` 之前）加入：
```typescript
        // 照片還原後 15 秒內跳過同步，避免覆蓋剛還原的資料
        if (Date.now() - photoRestoredAt.current < 15000) return;
```

完整修改後的開頭應為：
```typescript
    const syncWhatsFromPlanning = async () => {
      try {
        // 照片還原後 15 秒內跳過同步，避免覆蓋剛還原的資料
        if (Date.now() - photoRestoredAt.current < 15000) return;
        const sprintId = localStorage.getItem('currentSprintId');
```

- [ ] **Step 4：Commit**

```bash
cd /Users/ems-tainan/ClaudeCode/scrum-project
git add src/app/backlog/page.tsx
git commit -m "fix: add saveStatus, photoRestoredAt ref, and sync protection to backlog"
```

---

### Task 3：加入照片還原 handler 函式

**Files:**
- Modify: `src/app/backlog/page.tsx`

- [ ] **Step 1：在 handleAiGenerateTasks 函式下方加入 handlePhotoRestore**

找到 `handleAiGenerateTasks` 函式結尾的 `};`（約第 209 行），在其下方加入：

```typescript
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
      const reader = new FileReader();
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // 去掉 data:image/xxx;base64, 前綴
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetch('/api/ai-restore-backlog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: file.type, apiKey })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || '照片解析失敗');
      }

      const resData = await response.json();
      const restoredTasks = resData.tasks;

      if (!Array.isArray(restoredTasks)) {
        throw new Error('AI 回傳格式錯誤，請重試');
      }

      setTasks(restoredTasks);
      photoRestoredAt.current = Date.now();

      // 等 state 更新後立即存到 Firebase
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
```

- [ ] **Step 2：Commit**

```bash
cd /Users/ems-tainan/ClaudeCode/scrum-project
git add src/app/backlog/page.tsx
git commit -m "feat: add handlePhotoRestore function for Gemini Vision backlog restore"
```

---

### Task 4：加入 UI — SaveIndicator、照片還原按鈕、隱藏 file input

**Files:**
- Modify: `src/app/backlog/page.tsx`

- [ ] **Step 1：在檔案頂部 import SaveIndicator**

找到現有的 import 區塊（約第 5 行）：
```typescript
import ScrumTooltip from '@/components/ScrumTooltip';
```

在其下方加入：
```typescript
import SaveIndicator from '@/components/SaveIndicator';
```

- [ ] **Step 2：在 Navigation 下方加入 SaveIndicator**

找到（約第 532 行）：
```typescript
        <Navigation />
```

改為：
```typescript
        <div className="flex items-center justify-between">
          <Navigation />
          <SaveIndicator status={saveStatus} />
        </div>
```

- [ ] **Step 3：在看板標題列加入照片還原按鈕和隱藏 file input**

找到看板標題列的按鈕群組（約第 590 行）：
```typescript
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  const newId = `pbi-${Date.now()}`;
```

在 `<div className="flex items-center gap-3">` 之後、「新增 PBI」按鈕之前，加入：
```typescript
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoRestore}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isPhotoRestoring}
                className="bg-[#fffdf9] text-[#467386] border-2 border-[#76a5af] px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-[#daf0f5] transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPhotoRestoring ? '🔍 AI 解析中...' : '📸 從照片還原'}
              </button>
```

- [ ] **Step 4：Commit**

```bash
cd /Users/ems-tainan/ClaudeCode/scrum-project
git add src/app/backlog/page.tsx
git commit -m "feat: add photo restore button and SaveIndicator to backlog page"
```

---

### Task 5：本機測試與部署

**Files:**（無新增，驗證用）

- [ ] **Step 1：啟動本機 dev server**

```bash
cd /Users/ems-tainan/ClaudeCode/scrum-project
npm run dev
```

預期輸出包含 `Ready in` 且無 TypeScript 錯誤。

- [ ] **Step 2：驗證 TypeScript 編譯**

另開終端機執行：
```bash
cd /Users/ems-tainan/ClaudeCode/scrum-project
npx tsc --noEmit 2>&1
```

預期：無錯誤輸出（或只有 warning）。

- [ ] **Step 3：手動測試 SaveIndicator**

打開 http://localhost:3000/backlog，在任何欄位輸入文字，確認畫面頂部出現「等待儲存... → 儲存中... → ✓ 已儲存」狀態變化。

- [ ] **Step 4：手動測試照片還原按鈕**

1. 在 Backlog 頁頂部 API Key 欄位輸入 Gemini API Key（AIza 開頭）
2. 點擊「📸 從照片還原」
3. 選擇任務看板照片
4. 等待「🔍 AI 解析中...」完成
5. 確認 alert 顯示還原數量，任務看板更新

- [ ] **Step 5：部署到 Vercel**

```bash
cd /Users/ems-tainan/ClaudeCode/scrum-project
vercel --prod --yes 2>&1 | tail -10
```

預期輸出包含 `Production:` URL 和 `READY`。
