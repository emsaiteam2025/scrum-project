// Sprint Backlog 的共用型別。
// 原本 Task 寫在 backlog/page.tsx 內，因 /my-tasks 需要共用而抽出。
// 注意：Task 同時代表 PBI（type: 'pbi'）與任務（type: 'task'），
// 因此 attachments 一個欄位即涵蓋 PBI 與任務兩層。

export interface Attachment {
  id: string;
  name: string;
  url: string;            // Vercel Blob 原始 URL（private store 無法直接開啟，僅供除錯／稽核）
  // Blob 在 store 內的路徑。private store 的檔案必須透過 /api/blob 代理讀取，
  // 這個欄位就是代理與刪除時的識別依據（不要改用 url 反推）。
  pathname: string;
  size: number;           // bytes
  contentType: string;
  uploadedBy: string;     // email
  uploadedAt: number;     // Date.now()
}

// 進度紀錄：可累積的時間軸，讓接手的人讀完就知道發生過什麼、現在卡在哪。
// 刻意「只能刪、不能改」——事後可編輯的時間軸就失去被信任的價值。
export interface ProgressNote {
  id: string;
  text: string;
  authorName: string;   // 顯示用
  authorEmail: string;  // 判斷是否為本人所寫（決定能不能刪）
  ts: number;
}

export interface Subtask {
  id: string;
  title: string;          // 這位負責人負責的內容
  assignee: string;       // 開發者姓名，單一負責人
  assigneeEmail?: string; // 權限判斷依據；成員未填 email 時為 undefined
  status: 'todo' | 'doing' | 'done';
  time?: string;
  attachments?: Attachment[];
  notes?: ProgressNote[];
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
  notes?: ProgressNote[];
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
