"use client";
import { SaveStatus } from '@/hooks/useAutoSave';

const CONFIG: Record<SaveStatus, { label: string; color: string } | null> = {
  idle:    null,
  pending: { label: '等待儲存...', color: 'text-[#b5a695]' },
  saving:  { label: '儲存中...', color: 'text-[#5b755e]' },
  saved:   { label: '✓ 已儲存', color: 'text-[#4a7c59]' },
  error:   { label: '⚠ 儲存失敗（本機已備份）', color: 'text-[#c96262]' },
};

export default function SaveIndicator({ status }: { status: SaveStatus }) {
  const cfg = CONFIG[status];
  if (!cfg) return null;
  return (
    <span className={`text-sm font-bold ${cfg.color} transition-all`}>
      {cfg.label}
    </span>
  );
}
