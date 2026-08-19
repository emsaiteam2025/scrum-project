"use client";
import React, { useRef, useState } from 'react';
import { MessageSquare, Send, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { ProgressNote, DevMember } from '@/lib/taskTypes';

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
  /** @ 提及的候選名單；沒有 email 的成員無法被提及（收不到提醒） */
  devMembers?: DevMember[];
  onAppend: (text: string, mentions: string[]) => void;
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
  notes, currentUserEmail, readOnly, canDeleteAny, devMembers,
  onAppend, onDelete, defaultOpen,
}: ProgressLogProps) {
  const list = notes || [];
  const [open, setOpen] = useState(!!defaultOpen);
  const [draft, setDraft] = useState('');

  // 由新到舊：讀的人最想先知道「現在是什麼狀況」
  const ordered = [...list].sort((a, b) => b.ts - a.ts);
  const latest = ordered[0];

  // ── @ 提及 ──────────────────────────────────────────────
  // 只有填了 email 的成員才列入：沒有 email 就對不到登入身分，提醒送不到人。
  const mentionable = (devMembers || []).filter(m => m.name && m.email);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const candidates = mentionQuery === null
    ? []
    : mentionable.filter(m => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6);

  /** 依游標前的文字判斷是否正在打 @xxx（@ 後面不允許空白，避免整句話都被當成查詢） */
  const refreshMention = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const at = before.lastIndexOf('@');
    if (at < 0) { setMentionQuery(null); return; }
    const frag = before.slice(at + 1);
    if (/[\s]/.test(frag)) { setMentionQuery(null); return; }
    setMentionQuery(frag);
    setActiveIdx(0);
  };

  const insertMention = (name: string) => {
    const el = inputRef.current;
    const caret = el ? el.selectionStart ?? draft.length : draft.length;
    const before = draft.slice(0, caret);
    const at = before.lastIndexOf('@');
    if (at < 0) return;
    const next = `${draft.slice(0, at)}@${name} ${draft.slice(caret)}`;
    setDraft(next);
    setMentionQuery(null);
    // 插入後把游標移到名字之後，讓人可以接著打字
    requestAnimationFrame(() => {
      const pos = at + name.length + 2;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  };

  /** 提交當下把 @姓名 解析成 email 存起來，之後不再從文字反解 */
  const resolveMentions = (text: string): string[] =>
    mentionable.filter(m => text.includes(`@${m.name}`)).map(m => m.email);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onAppend(text, resolveMentions(text));
    setDraft('');
    setMentionQuery(null);
  };

  /** 把 @姓名 以主色標出來 */
  const renderText = (text: string): React.ReactNode => {
    if (mentionable.length === 0) return text;
    // 長名字優先，避免「小明」先吃掉「小明華」
    const names = mentionable.map(m => m.name).sort((a, b) => b.length - a.length);
    const parts: React.ReactNode[] = [];
    let rest = text;
    let key = 0;
    while (rest.length > 0) {
      const hit = names
        .map(n => ({ n, i: rest.indexOf(`@${n}`) }))
        .filter(x => x.i >= 0)
        .sort((a, b) => a.i - b.i)[0];
      if (!hit) { parts.push(rest); break; }
      if (hit.i > 0) parts.push(rest.slice(0, hit.i));
      parts.push(
        <span key={`m${key++}`} className="text-[#C96442] font-medium">@{hit.n}</span>
      );
      rest = rest.slice(hit.i + hit.n.length + 1);
    }
    return parts;
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
            <div className="flex gap-1 mb-1.5 relative">
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={e => {
                  setDraft(e.target.value);
                  refreshMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
                }}
                onKeyDown={e => {
                  // 候選清單開著時，方向鍵與 Enter 先給清單用，不要直接送出
                  if (candidates.length > 0) {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => (i + 1) % candidates.length); return; }
                    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => (i - 1 + candidates.length) % candidates.length); return; }
                    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(candidates[activeIdx].name); return; }
                    if (e.key === 'Escape') { e.preventDefault(); setMentionQuery(null); return; }
                  }
                  if (e.key === 'Enter') { e.preventDefault(); submit(); }
                }}
                onBlur={() => { setTimeout(() => setMentionQuery(null), 120); }}
                placeholder={mentionable.length > 0 ? '做到哪了？卡在什麼？打 @ 可以標記人' : '做到哪了？卡在什麼？下一步是什麼？'}
                className="flex-1 min-w-0 text-xs px-2 py-1.5 border border-[#E9E5DA] rounded-lg text-[#1F1D17] placeholder-[#B5B2A6] focus:outline-none focus:ring-2 focus:ring-[#F5E4DA]"
              />

              {candidates.length > 0 && (
                <div className="absolute left-0 bottom-full mb-1 z-20 bg-white border border-[#E9E5DA] rounded-lg shadow-md py-1 min-w-[140px]">
                  {candidates.map((m, idx) => (
                    <button
                      key={m.email}
                      type="button"
                      // onMouseDown 而非 onClick：onBlur 會先觸發並關掉清單，click 就永遠等不到
                      onMouseDown={e => { e.preventDefault(); insertMention(m.name); }}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`w-full text-left text-xs px-2.5 py-1.5 transition-colors ${
                        idx === activeIdx ? 'bg-[#F5E4DA] text-[#C96442]' : 'text-[#5A574E] hover:bg-[#F6F3EB]'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
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
                      {renderText(n.text)}
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
