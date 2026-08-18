"use client";
import React, { useEffect } from 'react';
import { X, Download, Loader2, FileText } from 'lucide-react';
import type { Attachment } from '@/lib/taskTypes';

export interface AttachmentViewerProps {
  attachment: Attachment;
  /** 已取回的 object URL；還在抓的時候為空字串 */
  objUrl: string;
  onClose: () => void;
}

const fmtSize = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/**
 * 附件全螢幕檢視。
 *
 * 用站內遮罩而非另開分頁：private 附件拿到的是 blob: 網址，部分瀏覽器的彈窗
 * 阻擋器會擋掉新分頁，而且截圖多半只是要瞄一眼確認，看完關掉就繼續，不該離開看板。
 */
export default function AttachmentViewer({ attachment, objUrl, onClose }: AttachmentViewerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    // 遮罩開啟時鎖住底層捲動，否則滾滑鼠會捲到後面的看板
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const isImage = attachment.contentType.startsWith('image/');
  const isPdf = attachment.contentType === 'application/pdf';

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 flex flex-col"
      onClick={onClose}
      // 這個遮罩可能出現在 draggable 的看板卡片內，攔掉拖曳避免誤觸
      onDragStart={e => e.stopPropagation()}
      draggable={false}
    >
      {/* 標題列 */}
      <div
        className="flex items-center gap-3 px-4 py-3 text-white shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{attachment.name}</div>
          <div className="text-xs text-white/60">
            {fmtSize(attachment.size)}　由 {attachment.uploadedBy || '未具名'} 上傳
          </div>
        </div>
        {objUrl && (
          <a
            href={objUrl}
            download={attachment.name}
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors shrink-0"
          >
            <Download size={14} strokeWidth={1.75} /> 下載
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/20 transition-colors shrink-0"
          title="關閉（ESC）"
        >
          <X size={18} strokeWidth={1.75} />
        </button>
      </div>

      {/* 內容 */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-4">
        {!objUrl ? (
          <div className="flex items-center gap-2 text-white/80 text-sm">
            <Loader2 size={16} className="animate-spin" /> 載入中…
          </div>
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={objUrl}
            alt={attachment.name}
            onClick={e => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded"
          />
        ) : isPdf ? (
          <iframe
            src={objUrl}
            title={attachment.name}
            onClick={e => e.stopPropagation()}
            className="w-full h-full bg-white rounded"
          />
        ) : (
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-xl px-6 py-8 flex flex-col items-center gap-3 max-w-sm text-center"
          >
            <FileText size={32} strokeWidth={1.5} className="text-[#8B887E]" />
            <div className="text-sm font-medium text-[#1F1D17] break-all">{attachment.name}</div>
            <div className="text-xs text-[#8B887E]">
              這個格式沒辦法在瀏覽器裡直接預覽，請下載後開啟。
            </div>
            <a
              href={objUrl}
              download={attachment.name}
              className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-[#1F1D17] text-white hover:bg-[#5A574E] transition-colors"
            >
              <Download size={14} strokeWidth={1.75} /> 下載檔案
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
