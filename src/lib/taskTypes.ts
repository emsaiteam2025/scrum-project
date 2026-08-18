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
