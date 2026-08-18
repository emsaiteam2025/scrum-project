"use client";
import React, { useRef, useState } from 'react';
import { Paperclip, X, Loader2 } from 'lucide-react';
import type { Attachment } from '@/lib/taskTypes';

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
