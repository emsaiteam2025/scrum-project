"use client";

import React, { useState } from 'react';
import Navigation from '@/components/Navigation';

const principles = [
  {
    num: 1,
    category: '客戶與交付',
    en: 'Our highest priority is to satisfy the customer through early and continuous delivery of valuable software.',
    zh: '我們的最高優先順序是，及早並持續地交付有價值的軟體以滿足客戶需求。',
  },
  {
    num: 2,
    category: '客戶與交付',
    en: 'Welcome changing requirements, even late in development. Agile process harness change for the customer\'s competitive advantage.',
    zh: '歡迎客戶需求的變更，即使是在任何階段含晚期皆是。敏捷流程將「變更」轉化為客戶競事優勢。',
  },
  {
    num: 3,
    category: '客戶與交付',
    en: 'Deliver working software frequently, from a couple of weeks to a couple of months, with a preference to the shorter timescale.',
    zh: '不論週期是數週或是數月，要定期且頻繁地交付正常運作的軟體，且週期越短越好。',
  },
  {
    num: 4,
    category: '客戶與交付',
    en: 'Business people and developers must work together daily throughout the project.',
    zh: '客戶代表與開發人員在專案期間應每日持續互動。',
  },
  {
    num: 5,
    category: '團隊與溝通',
    en: 'Build projects around motivated individuals. Give them the environment and support they need, and trust them to get the job done.',
    zh: '激勵專案團隊自動自發，提供他們所需要的環境與支援，相信他們會使命必達。',
  },
  {
    num: 6,
    category: '團隊與溝通',
    en: 'The most efficient and effective method of conveying information to and within a development team is face-to-face conversation.',
    zh: '團隊不論對內或對外，最有效率及效能的資訊傳遞方式就是面對面對話。',
  },
  {
    num: 7,
    category: '團隊與溝通',
    en: 'Working software is the primary measure of progress.',
    zh: '可正常運作的軟體（產品）是主要衡量專案進度的指標。',
  },
  {
    num: 8,
    category: '團隊與溝通',
    en: 'Agile processes promote sustainable development. The sponsors, developers and user should be able to maintain a constant pace indefinitely.',
    zh: '敏捷工作流程強調穩定發展。發起人、開發人員和用戶應合作並保持長時間的穩定步調。',
  },
  {
    num: 9,
    category: '技術與改善',
    en: 'Continuous attention to technical excellence and good design enhances agility.',
    zh: '持續注重在專精的技術及良好的設計，可強化敏捷的優勢。',
  },
  {
    num: 10,
    category: '技術與改善',
    en: 'Simplicity — the art of maximizing the amount of work not done — is essential.',
    zh: '簡單是美，如何將不需要的工作項目數量最大化是重要的。',
  },
  {
    num: 11,
    category: '技術與改善',
    en: 'The best architectures, requirements, and designs emerge from self-organizing teams.',
    zh: '最佳框架、需求與設計是來自自組織的團隊。',
  },
  {
    num: 12,
    category: '技術與改善',
    en: 'At regular intervals, the team reflects on how to become more effective, then tunes and adjusts its behavior accordingly.',
    zh: '團隊定期省思如何提高效率，並依此調整其做事方法。',
  },
];

const categoryStyle: Record<string, { badge: string; card: string; num: string; numText: string }> = {
  '客戶與交付': {
    badge: 'bg-[#fde8d8] text-[#c06030] border border-[#f0b080]',
    card: 'bg-[#fff8f4] border-[#f0c8a0]',
    num: 'bg-[#e07a5f] text-white',
    numText: 'text-[#c06030]',
  },
  '團隊與溝通': {
    badge: 'bg-[#dff0e8] text-[#2e7d5e] border border-[#8fc8a8]',
    card: 'bg-[#f4fcf8] border-[#a8d8b8]',
    num: 'bg-[#3a8f6a] text-white',
    numText: 'text-[#2e7d5e]',
  },
  '技術與改善': {
    badge: 'bg-[#daeaf4] text-[#2a6080] border border-[#80b8d8]',
    card: 'bg-[#f4f9fd] border-[#a0c8e8]',
    num: 'bg-[#3a7aaa] text-white',
    numText: 'text-[#2a6080]',
  },
};

const categories = ['客戶與交付', '團隊與溝通', '技術與改善'];
const categoryRange: Record<string, string> = {
  '客戶與交付': '第 1–4 條',
  '團隊與溝通': '第 5–8 條',
  '技術與改善': '第 9–12 條',
};

const scrumValues = [
  {
    letter: 'C',
    en: 'Commitment',
    zh: '承諾',
    desc: '團隊共同致力於實現目標。',
    bg: 'bg-[#fff8f4]', border: 'border-[#f0c8a0]',
    badge: 'bg-[#e07a5f] text-white', text: 'text-[#c06030]',
  },
  {
    letter: 'C',
    en: 'Courage',
    zh: '勇氣',
    desc: '敢於面對困難、挑戰現狀並做出改變。',
    bg: 'bg-[#f4f9fd]', border: 'border-[#a0c8e8]',
    badge: 'bg-[#3a7aaa] text-white', text: 'text-[#2a6080]',
  },
  {
    letter: 'F',
    en: 'Focus',
    zh: '專注',
    desc: '全神貫注於短衝（Sprint）目標及當前任務。',
    bg: 'bg-[#f4fcf8]', border: 'border-[#a8d8b8]',
    badge: 'bg-[#3a8f6a] text-white', text: 'text-[#2e7d5e]',
  },
  {
    letter: 'O',
    en: 'Openness',
    zh: '開放',
    desc: '對工作細節、挑戰保持透明與接納態度。',
    bg: 'bg-[#f9f4fc]', border: 'border-[#c8a8d8]',
    badge: 'bg-[#7a5aaa] text-white', text: 'text-[#604080]',
  },
  {
    letter: 'R',
    en: 'Respect',
    zh: '尊重',
    desc: '成員間彼此信任，認可各自的專業價值。',
    bg: 'bg-[#fef9f4]', border: 'border-[#d8c0a0]',
    badge: 'bg-[#8b5a2b] text-white', text: 'text-[#6b4020]',
  },
];

const resources = [
  {
    icon: '📖',
    title: 'Agile Manifesto 原文',
    desc: '敏捷宣言官方網站，包含 4 大核心價值與 12 項原則完整英文原文。',
    url: 'https://agilemanifesto.org/',
    tag: '官方',
  },
  {
    icon: '🌐',
    title: 'Scrum Guide（官方指南）',
    desc: 'Scrum 共同創辦人 Ken Schwaber 與 Jeff Sutherland 撰寫的官方指南，2020 年最新版。',
    url: 'https://scrumguides.org/scrum-guide.html',
    tag: '官方',
  },
  {
    icon: '📘',
    title: 'Scrum Guide 繁體中文版',
    desc: 'Scrum Guide 繁體中文翻譯版本，適合中文使用者快速理解 Scrum 架構。',
    url: 'https://scrumguides.org/docs/scrumguide/v2020/2020-Scrum-Guide-Chinese-Traditional.pdf',
    tag: '繁體中文',
  },
  {
    icon: '🎓',
    title: 'Scrum Alliance',
    desc: '全球最大 Scrum 認證機構，提供 CSM、CSPO 等各類敏捷認證課程資訊。',
    url: 'https://www.scrumalliance.org/',
    tag: '認證',
  },
  {
    icon: '🛠️',
    title: 'Mountain Goat Software — Scrum Resources',
    desc: 'Mike Cohn 整理的 Scrum 實踐資源庫，包含使用者故事、估點、速度等實用教學。',
    url: 'https://www.mountaingoatsoftware.com/agile/scrum',
    tag: '實踐',
  },
  {
    icon: '📊',
    title: 'State of Agile Report',
    desc: 'Digital.ai 每年發布的敏捷現況調查報告，了解全球敏捷導入趨勢與挑戰。',
    url: 'https://digital.ai/resource-center/analyst-reports/state-of-agile-report/',
    tag: '報告',
  },
];

export default function KnowledgePage() {
  const [tab, setTab] = useState<'agile' | 'scrum-values' | 'resources'>('agile');

  return (
    <main className="min-h-screen bg-[#f4f1ea] p-8 font-serif text-[#3e362e] bg-[url('https://www.transparenttextures.com/patterns/rice-paper-2.png')]">
      <div className="w-full space-y-6">
        <Navigation />

        {/* 頁頭 */}
        <header className="bg-[#fffdf9] border-2 border-[#b5a695] rounded-2xl p-6 shadow-sm">
          <div className="text-xs font-bold text-[#8a7f72] mb-1">知識學習</div>
          <h1 className="text-3xl font-bold text-[#3e362e] mb-1">知識學習</h1>
          <p className="text-sm text-[#6b5e50]">Agile &amp; Scrum 基礎知識，幫助團隊建立共識</p>

          {/* 分頁標籤 */}
          <div className="flex gap-0 mt-5 border-b-2 border-[#d3cbbd]">
            <button
              onClick={() => setTab('agile')}
              className={`px-5 py-2 text-sm font-bold border-b-2 transition-all -mb-[2px] ${
                tab === 'agile'
                  ? 'border-[#3a7aaa] text-[#3a7aaa]'
                  : 'border-transparent text-[#8a7f72] hover:text-[#5b755e]'
              }`}
            >
              Agile 12 準則
            </button>
            <button
              onClick={() => setTab('scrum-values')}
              className={`px-5 py-2 text-sm font-bold border-b-2 transition-all -mb-[2px] ${
                tab === 'scrum-values'
                  ? 'border-[#3a7aaa] text-[#3a7aaa]'
                  : 'border-transparent text-[#8a7f72] hover:text-[#5b755e]'
              }`}
            >
              Scrum 核心價值
            </button>
            <button
              onClick={() => setTab('resources')}
              className={`px-5 py-2 text-sm font-bold border-b-2 transition-all -mb-[2px] ${
                tab === 'resources'
                  ? 'border-[#3a7aaa] text-[#3a7aaa]'
                  : 'border-transparent text-[#8a7f72] hover:text-[#5b755e]'
              }`}
            >
              延伸資源
            </button>
          </div>
        </header>

        {/* Agile 12 準則 */}
        {tab === 'agile' && (
          <div className="space-y-8">
            {categories.map(cat => {
              const style = categoryStyle[cat];
              const catPrinciples = principles.filter(p => p.category === cat);
              return (
                <div key={cat}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${style.badge}`}>{cat}</span>
                    <span className="text-xs text-[#8a7f72]">{categoryRange[cat]}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {catPrinciples.map(p => (
                      <div key={p.num} className={`rounded-2xl border-2 p-5 ${style.card}`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 ${style.num}`}>
                            {p.num}
                          </div>
                          <div>
                            <div className={`text-sm font-bold leading-snug mb-2 ${style.numText}`}>{p.en}</div>
                            <div className="text-sm text-[#6b5e50] leading-relaxed">{p.zh}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <p className="text-xs text-[#8a7f72] pt-2">
              Beck, K., et al. (2001). Manifesto for Agile Software Development. Retrieved from{' '}
              <a href="https://agilemanifesto.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#3a7aaa]">
                https://agilemanifesto.org/
              </a>
            </p>
          </div>
        )}

        {/* Scrum 五大核心價值觀 */}
        {tab === 'scrum-values' && (
          <div className="space-y-6">
            {/* 說明卡 */}
            <div className="bg-[#fffdf9] border-2 border-[#d3cbbd] rounded-2xl p-5">
              <div className="text-base font-bold text-[#3e362e] mb-2">
                「CCFOR」— Scrum 五大核心價值觀
              </div>
              <p className="text-sm text-[#6b5e50] leading-relaxed">
                「<strong>CCFOR</strong>」是 Scrum 敏捷開發中至關重要的 <strong>五大核心價值觀</strong>，
                這五個單字分別代表 Commitment（承諾）、Courage（勇氣）、Focus（專注）、
                Openness（開放）、Respect（尊重）。這些價值觀是 Scrum 框架運作的基礎，
                引導團隊成員在每一次短衝（Sprint）中建立信任、提升效能。
              </p>
            </div>

            {/* CCFOR 字母橫排 */}
            <div className="flex justify-center gap-3 flex-wrap">
              {scrumValues.map((v, i) => (
                <div key={i} className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black shrink-0 ${v.badge}`}>
                  {v.letter}
                </div>
              ))}
            </div>

            {/* 五大價值卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scrumValues.map((v, i) => (
                <div key={i} className={`rounded-2xl border-2 p-5 ${v.bg} ${v.border}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0 ${v.badge}`}>
                      {v.letter}
                    </div>
                    <div>
                      <div className={`font-bold text-base leading-snug ${v.text}`}>
                        {v.en} <span className="text-sm font-semibold">（{v.zh}）</span>
                      </div>
                      <div className="text-sm text-[#6b5e50] leading-relaxed mt-1.5">{v.desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-[#8a7f72] pt-2">
              參考來源：The Scrum Guide (2020). Scrum Values. Retrieved from{' '}
              <a href="https://scrumguides.org/scrum-guide.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#3a7aaa]">
                https://scrumguides.org/scrum-guide.html
              </a>
            </p>
          </div>
        )}

        {/* 延伸資源 */}
        {tab === 'resources' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {resources.map((r, i) => (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#fffdf9] border-2 border-[#d3cbbd] rounded-2xl p-5 hover:border-[#8fb996] hover:shadow-md transition-all group flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{r.icon}</span>
                    <div className="font-bold text-[#3e362e] group-hover:text-[#3a7aaa] transition-colors">{r.title}</div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-[#e8eedd] text-[#5b755e] border border-[#8fb996] rounded-full whitespace-nowrap">{r.tag}</span>
                </div>
                <p className="text-sm text-[#6b5e50] leading-relaxed">{r.desc}</p>
                <div className="text-xs text-[#8a7f72] group-hover:text-[#3a7aaa] transition-colors break-all">{r.url}</div>
              </a>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
