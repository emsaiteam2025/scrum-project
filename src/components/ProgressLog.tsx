"use client";
import React, { useState } from 'react';
import { MessageSquare, Send, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { ProgressNote } from '@/lib/taskTypes';

export interface ProgressLogProps {
  notes: ProgressNote[];
  /** 目前登入者，用來判斷哪些紀錄可以刪（作者名稱由伺服器寫入時決定，不需前端傳） */
  currentUserEmail: string;
  /** 有編輯權才給輸入框；純檢視者只能讀 */
  readOnly?: boolean;
  /** 管理者（擁有者／PO／SM）可刪除任何人的紀錄 */
  canDeleteAny?: boolean;
  /** 追加一則。刻意只傳文字：實際的陣列要在 transaction 內部追加，
   *  在外面算好整包送出會讓同時記錄的兩個人互相吃掉對方那則。 */
  onAppend: (text: string) => void;
  onDelete: (noteId: string) => void;
  /** 看板卡片上空間有限，預設收合 */
  defaultOpen?: boolean;
}

function fmtTs(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ` +
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ProgressLog({
  notes, currentUserEmail, readOnly, canDeleteAny,
  onAppend, onDelete, defaultOpen,
}: ProgressLogProps) {
  const list = notes || [];
  const [open, setOpen] = useState(!!defaultOpen);
  const [draft, setDraft] = useState('');

  // 由新到舊：讀的人最想先知道「現在是什麼狀況」
  const ordered = [...list].sort((a, b) => b.ts - a.ts);
  const latest = ordered[0];

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onAppend(text);
    setDraft('');
  };

  const mine = (n: ProgressNote) =>
    !!currentUserEmail && n.authorEmail.toLowerCase() === currentUserEmail.toLowerCase();

  if (readOnly && list.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-[#E9E5DA]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 text-left group/log"
      >
        <MessageSquare size={11} strokeWidth={1.75} className="text-[#8B887E] shrink-0" />
        <span className="text-[11px] font-medium text-[#5A574E] shrink-0">進度紀錄</span>
        {list.length > 0 && (
          <span className="text-[10px] text-[#8B887E] shrink-0">{list.length} 則</span>
        )}
        {/* 收合時直接把最新一則露出來，多數情況下不必展開就知道近況 */}
        {!open && latest && (
          <span className="text-[10px] text-[#8B887E] truncate flex-1 min-w-0">
            {latest.authorName}：{latest.text}
          </span>
        )}
        <span className="ml-auto text-[#B5B2A6] group-hover/log:text-[#5A574E] shrink-0">
          {open
            ? <ChevronUp size={12} strokeWidth={1.75} />
            : <ChevronDown size={12} strokeWidth={1.75} />}
        </span>
      </button>

      {open && (
        <div className="mt-1.5">
          {!readOnly && (
            <div className="flex gap-1 mb-1.5">
              <input
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                placeholder="做到哪了？卡在什麼？下一步是什麼？"
                className="flex-1 min-w-0 text-xs px-2 py-1.5 border border-[#E9E5DA] rounded-lg text-[#1F1D17] placeholder-[#B5B2A6] focus:outline-none focus:ring-2 focus:ring-[#F5E4DA]"
              />
              <button
                type="button"
                onClick={submit}
                disabled={!draft.trim()}
                className="flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-lg border border-[#C96442] text-[#C96442] hover:bg-[#F5E4DA] transition-colors disabled:opacity-40 disabled:hover:bg-transparent shrink-0"
              >
                <Send size={11} strokeWidth={1.75} /> 記錄
              </button>
            </div>
          )}

          {ordered.length === 0 ? (
            <div className="text-[10px] text-[#B5B2A6] py-1">
              還沒有紀錄。寫下進展或卡關，接手的人才知道從哪繼續。
            </div>
          ) : (
            <div className="space-y-1">
              {ordered.map(n => (
                <div key={n.id} className="flex items-start gap-1.5 bg-[#F6F3EB] border border-[#E9E5DA] rounded-md px-2 py-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-[#5A574E]">{n.authorName}</span>
                      <span className="text-[10px] text-[#B5B2A6]">{fmtTs(n.ts)}</span>
                    </div>
                    <div className="text-xs text-[#1F1D17] break-words whitespace-pre-wrap leading-relaxed">
                      {n.text}
                    </div>
                  </div>
                  {!readOnly && (mine(n) || canDeleteAny) && (
                    <button
                      type="button"
                      onClick={() => { if (window.confirm('確定要刪除這則紀錄嗎？')) onDelete(n.id); }}
                      className="text-[#B5B2A6] hover:text-[#B8543C] p-0.5 rounded transition-colors shrink-0"
                      title="刪除這則紀錄"
                    >
                      <Trash2 size={11} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
