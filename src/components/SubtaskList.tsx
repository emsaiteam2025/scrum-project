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
  // sprintId / currentUserEmail 供 Task 8 接上 AttachmentBox 使用，此任務僅先定義 props
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
