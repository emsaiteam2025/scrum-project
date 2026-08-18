"use client";
import React from 'react';
import { MessageSquare } from 'lucide-react';
import type { Task } from '@/lib/taskTypes';
import { standupWindow, collectDigest } from '@/lib/progressDigest';

export interface DailyProgressDigestProps {
  tasks: Task[];
  sprintStartDate: string;
  dayIndex: number;
  isHoliday: (iso: string) => boolean;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ` +
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 站會用的唯讀進度摘要：把這段期間大家寫在任務／子任務上的進度紀錄，
 * 依人分組列出來，站會時看著它講就好，不必再口頭複述一次。
 *
 * 刻意唯讀且不寫入任何資料——Q1/Q2/Q3 是人工填的欄位，這塊不去碰它們。
 */
export default function DailyProgressDigest({
  tasks, sprintStartDate, dayIndex, isHoliday,
}: DailyProgressDigestProps) {
  const win = standupWindow(sprintStartDate, dayIndex, isHoliday);
  if (!win) return null;

  const groups = collectDigest(tasks || [], win);
  const total = groups.reduce((n, g) => n + g.entries.length, 0);

  return (
    <div className="flex flex-col gap-2 mb-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        <MessageSquare size={14} strokeWidth={1.75} className="text-[#8B887E]" />
        <span className="font-semibold text-sm text-[#1F1D17]">這段期間的進度紀錄</span>
        <span className="text-xs text-[#8B887E]">自 {win.startLabel} 以來</span>
        {total > 0 && (
          <span className="text-[10px] text-[#5A574E] bg-[#F1EEE6] px-1.5 py-0.5 rounded-full border border-[#E9E5DA]">
            {total} 則
          </span>
        )}
      </div>

      {total === 0 ? (
        <div className="text-xs text-[#8B887E] bg-[#F6F3EB] border border-[#E9E5DA] rounded-lg px-3 py-2.5">
          這段期間還沒有人在任務上寫進度紀錄。到 Sprint Backlog 或「我的工作」記一筆，下次站會就不用從頭講起。
        </div>
      ) : (
        <div className="bg-[#F6F3EB] border border-[#E9E5DA] rounded-lg divide-y divide-[#E9E5DA]">
          {groups.map(g => (
            <div key={g.author} className="px-3 py-2">
              <div className="text-xs font-semibold text-[#1F1D17] mb-1">{g.author}</div>
              <div className="space-y-1">
                {g.entries.map(e => (
                  <div key={e.note.id} className="flex items-start gap-1.5">
                    <span className="text-[10px] text-[#B5B2A6] shrink-0 mt-0.5 font-mono">
                      {fmtTime(e.note.ts)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-[#8B887E]">
                        {e.taskTitle}{e.subtaskTitle ? ` › ${e.subtaskTitle}` : ''}
                      </span>
                      <div className="text-xs text-[#1F1D17] break-words whitespace-pre-wrap leading-relaxed">
                        {e.note.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
