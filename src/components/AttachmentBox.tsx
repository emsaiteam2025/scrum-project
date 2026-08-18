"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, X, Loader2 } from 'lucide-react';
import type { Attachment } from '@/lib/taskTypes';
import { auth } from '@/lib/firebase';
import AttachmentViewer from '@/components/AttachmentViewer';

// /api/upload 需要 Firebase ID Token 才會受理。取不到就讓請求帶空 header，
// 由伺服器統一回 401，前端不必自己判斷登入狀態。
async function authHeader(): Promise<Record<string, string>> {
  try {
    const token = await auth.currentUser?.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

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

  // private store 的檔案必須帶著 token 去 /api/blob 取，取回後轉成 object URL 才能
  // 餵給 <img src> / <a href>——瀏覽器不會在這兩個標籤上帶 Authorization header。
  const [objUrls, setObjUrls] = useState<Record<string, string>>({});
  const objUrlsRef = useRef<Record<string, string>>({});
  objUrlsRef.current = objUrls;

  const [viewing, setViewing] = useState<Attachment | null>(null);
  const [fetching, setFetching] = useState<string | null>(null);

  // 所有建立過的 object URL 都要記下來：預抓那批由 effect 的 cleanup 處理，
  // 但點擊時才抓的那些不在 effect 裡，沒有這個 ref 就會一路累積到重新整理為止。
  const createdUrlsRef = useRef<string[]>([]);
  useEffect(() => () => {
    createdUrlsRef.current.forEach(URL.revokeObjectURL);
    createdUrlsRef.current = [];
  }, []);

  const fetchObjUrl = async (att: Attachment): Promise<string> => {
    const cached = objUrlsRef.current[att.pathname];
    if (cached) return cached;
    const header = await authHeader();
    if (!header.Authorization) return '';
    const res = await fetch(`/api/blob?p=${encodeURIComponent(att.pathname)}`, { headers: header });
    if (!res.ok) return '';
    const objUrl = URL.createObjectURL(await res.blob());
    createdUrlsRef.current.push(objUrl);
    setObjUrls(prev => ({ ...prev, [att.pathname]: objUrl }));
    return objUrl;
  };

  // 只預抓圖片——縮圖需要它，也讓點開彈視窗是瞬間的。
  // 非圖片（PDF／Office／zip）沒有縮圖可畫，預抓等於白下載幾 MB，改成點擊時才抓。
  const imageKey = list.filter(a => isImage(a.contentType)).map(a => a.pathname).join('|');
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];

    (async () => {
      const header = await authHeader();
      if (!header.Authorization) return; // 未登入就不試著取，交由畫面顯示檔名即可
      for (const att of list) {
        if (!att.pathname || !isImage(att.contentType)) continue;
        if (objUrlsRef.current[att.pathname]) continue;
        try {
          const res = await fetch(`/api/blob?p=${encodeURIComponent(att.pathname)}`, { headers: header });
          if (!res.ok) continue;
          const objUrl = URL.createObjectURL(await res.blob());
          created.push(objUrl);
          if (cancelled) { URL.revokeObjectURL(objUrl); return; }
          setObjUrls(prev => ({ ...prev, [att.pathname]: objUrl }));
        } catch {
          /* 取不到就只顯示檔名，不擋畫面 */
        }
      }
    })();

    return () => { cancelled = true; created.forEach(URL.revokeObjectURL); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey]);

  // 點擊開啟：圖片通常已預抓好、立刻就開；非圖片先開視窗顯示載入中再抓
  const openViewer = async (att: Attachment) => {
    setViewing(att);
    if (objUrlsRef.current[att.pathname]) return;
    setFetching(att.pathname);
    try {
      await fetchObjUrl(att);
    } catch {
      /* 失敗就讓視窗停在載入中，使用者可關掉重試 */
    } finally {
      setFetching(null);
    }
  };

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
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: await authHeader(),
          body: form,
        });
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
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ pathname: att.pathname }),
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
              {/* 整塊都可點開檢視——截圖多半是要瞄一眼確認，不該還要先下載 */}
              <button
                type="button"
                onClick={() => openViewer(att)}
                className="flex items-center gap-1.5 min-w-0 text-left"
                title={`${att.name}（${fmtSize(att.size)}）— 點擊檢視`}
              >
                {isImage(att.contentType) && objUrls[att.pathname] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={objUrls[att.pathname]}
                    alt={att.name}
                    className="w-12 h-12 object-cover rounded border border-[#E9E5DA] shrink-0"
                  />
                ) : fetching === att.pathname ? (
                  <Loader2 size={11} strokeWidth={1.75} className="text-[#8B887E] animate-spin shrink-0" />
                ) : (
                  <Paperclip size={11} strokeWidth={1.75} className="text-[#8B887E] shrink-0" />
                )}
                <span className="text-[10px] text-[#5A574E] hover:text-[#C96442] max-w-[110px] truncate">
                  {att.name}
                </span>
              </button>
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

      {viewing && (
        <AttachmentViewer
          attachment={viewing}
          objUrl={objUrls[viewing.pathname] || ''}
          onClose={() => setViewing(null)}
        />
      )}

      {!compact && !readOnly && (
        <div className="text-[10px] text-[#B5B2A6] mt-1">
          單檔上限 10 MB。檔案存放於私有儲存，必須登入才能檢視或下載。
        </div>
      )}
    </div>
  );
}
