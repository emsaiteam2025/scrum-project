"use client";

// ── 歷次改善行動彙總 ──
// 把各 Sprint retrospective 的「挑戰最大效益來改」(actionItems) 彙整成一份唯讀清單。
// Retrospective 頁面與成效報告共用同一個元件，確保兩邊呈現一致。

import React from 'react';
import { Zap } from 'lucide-react';
import { getDevNames } from '@/lib/sprints';

export interface DigestSprint {
  id: string;
  name?: string;
  createdAt?: number;
  planning?: {
    startDate?: string;
    sprintName?: string;
    po?: string;
    devs?: string;
    devsList?: { name: string }[];
  };
  retrospective?: { actionItems?: string };
}

// 已經有 -／*／•／1.／(1) 等標記開頭的行，去掉原標記，避免與畫面的項目符號重複
const BULLET_PREFIX = /^\s*(?:[-*•‧・–—]|\d+[.)、]|\(\d+\))\s*/;

export function splitActionLines(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.replace(BULLET_PREFIX, '').trim())
    .filter(Boolean);
}

// 日期優先用 planning.startDate 的字串直接格式化，不經過 Date，避免時區把日期位移一天
function sprintDateLabel(s: DigestSprint): string {
  const sd = s.planning?.startDate;
  if (sd) {
    const m = sd.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}/${m[2]}/${m[3]}`;
    return sd;
  }
  if (s.createdAt) return new Date(s.createdAt).toLocaleDateString('zh-TW');
  return '';
}

function sprintTitle(s: DigestSprint): string {
  return s.name || s.planning?.sprintName || '未命名 Sprint';
}

export default function ActionItemsDigest({
  sprints,
  currentSprintId,
}: {
  sprints: DigestSprint[];
  currentSprintId?: string | null;
}) {
  // 新到舊；沒填改善行動的 Sprint 直接略過
  const entries = sprints
    .filter(s => (s.retrospective?.actionItems || '').trim())
    .map(s => ({
      id: s.id,
      title: sprintTitle(s),
      date: sprintDateLabel(s),
      po: s.planning?.po?.trim() || '',
      devs: getDevNames(s.planning),
      lines: splitActionLines(s.retrospective!.actionItems!),
    }))
    .reverse();

  const totalActions = entries.reduce((n, e) => n + e.lines.length, 0);

  return (
    <section className="bg-white border border-[#E9E5DA] rounded-xl overflow-hidden">
      <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-5 py-3 flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-[#C96442] flex items-center justify-center flex-shrink-0">
          <Zap size={13} strokeWidth={2} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-[#1F1D17]">歷次改善行動彙總</span>
        <span className="text-[10px] text-[#8B887E]">挑戰最大效益來改 · Action Items</span>
        {entries.length > 0 && (
          <span className="ml-auto text-[11px] text-[#8B887E]">
            {entries.length} 個 Sprint · 共 {totalActions} 項
          </span>
        )}
      </div>

      <div className="p-5">
        {entries.length === 0 ? (
          <p className="text-xs text-[#B5B2A6]">
            目前還沒有任何 Sprint 填寫改善行動。在 Sprint Retrospective 的「挑戰最大效益來改」填寫後就會彙整到這裡。
          </p>
        ) : (
          // 卡片本身很窄（一則行動多半一兩行），單欄排在寬螢幕會空掉大半個版面。
          // 依寬度分欄，items-start 讓每張卡片各自貼齊頂端、不被同列最高的撐開。
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-x-8 gap-y-5 items-start">
            {entries.map(e => (
              <div key={e.id} className="border-l-[3px] border-l-[#C96442] pl-4">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-[#1F1D17]">{e.title}</span>
                  {e.date && <span className="text-[11px] text-[#8B887E]">{e.date}</span>}
                  {currentSprintId === e.id && (
                    <span className="text-[10px] text-[#C96442] bg-[#F5E4DA] px-2 py-0.5 rounded-full">本次</span>
                  )}
                </div>
                {(e.po || e.devs.length > 0) && (
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-[11px] text-[#8B887E]">
                    {e.po && (
                      <span>
                        PO：<span className="text-[#5A574E]">{e.po}</span>
                      </span>
                    )}
                    {e.devs.length > 0 && (
                      <span>
                        開發人員：<span className="text-[#5A574E]">{e.devs.join('、')}</span>
                      </span>
                    )}
                  </div>
                )}
                <ul className="mt-1.5 space-y-1">
                  {e.lines.map((line, i) => (
                    <li key={i} className="text-xs text-[#5A574E] leading-relaxed flex gap-2">
                      <span className="text-[#C96442] flex-shrink-0">•</span>
                      <span className="whitespace-pre-wrap break-words">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
