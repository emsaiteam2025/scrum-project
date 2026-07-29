"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useAutoSave } from '@/hooks/useAutoSave';
import Navigation from '@/components/Navigation';
import SaveIndicator from '@/components/SaveIndicator';
import ScrumTooltip from '@/components/ScrumTooltip';
import CountdownTimer from '@/components/CountdownTimer';
import ActionItemsDigest, { type DigestSprint } from '@/components/ActionItemsDigest';
import { useAuth } from '@/components/AuthProvider';
import { fetchAccessibleSprints } from '@/lib/sprints';
import { BookOpen, Music, FileText, Sprout, AlertTriangle, Zap, Target, Play, Square, CheckCircle2, Save } from 'lucide-react';

function parseYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function AutoGrowTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };
  useEffect(() => { resize(); }, [props.value]);
  return <textarea ref={ref} {...props} onInput={resize} />;
}

const taClass = "block w-full px-4 py-3 bg-white border border-[#E9E5DA] rounded-[9px] focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] text-[#1F1D17] text-sm placeholder:text-[#B5B2A6] resize-none min-h-[200px] overflow-hidden whitespace-pre-wrap break-words";

export default function SprintRetrospective() {
  const [urlInput, setUrlInput] = useState('');
  const [embedId, setEmbedId] = useState<string | null>(null);
  const [musicError, setMusicError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('retro_music_url');
    if (saved) setUrlInput(saved);
  }, []);

  const handlePlayMusic = () => {
    const id = parseYoutubeId(urlInput.trim());
    if (!id) {
      setMusicError('請貼上有效的 YouTube 連結');
      return;
    }
    setMusicError('');
    setEmbedId(id);
    localStorage.setItem('retro_music_url', urlInput.trim());
  };

  const handleStopMusic = () => {
    setEmbedId(null);
  };

  const { data, updateData, loading, saveStatus } = useAutoSave('retrospective', {
    previousActions: '',
    keepStart: '',
    problemStop: '',
    actionItems: '',
    actionTracker: ''
  });

  // 歷次改善行動彙總：載入所有可存取的 Sprint（自己擁有的＋自己是協作者的）
  const { user } = useAuth();
  const [allSprints, setAllSprints] = useState<DigestSprint[]>([]);
  const [currentSprintId, setCurrentSprintId] = useState<string | null>(null);
  useEffect(() => {
    setCurrentSprintId(localStorage.getItem('currentSprintId'));
    if (!user) return;
    fetchAccessibleSprints<DigestSprint>({ uid: user.uid, email: user.email })
      .then(setAllSprints)
      .catch(() => {});
  }, [user]);

  return (
    <main className="min-h-screen bg-[#FAF9F5] p-4 md:p-8 font-sans text-[#1F1D17]">
      <div className="w-full space-y-6">

        <div className="flex flex-col items-center">
          <Navigation />
          <SaveIndicator status={saveStatus} />
        </div>

        {loading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
            <div className="bg-white px-6 py-4 rounded-xl border border-[#E9E5DA] text-[#5A574E] shadow-xl text-sm flex items-center gap-3">
              <Save size={15} strokeWidth={1.75} className="text-[#8B887E]" />
              <span>載入資料中...</span>
            </div>
          </div>
        )}

        {/* 會議宗旨 */}
        <section className="bg-white border border-[#E9E5DA] rounded-xl overflow-hidden">
          <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-5 py-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#C96442] flex items-center justify-center flex-shrink-0">
              <BookOpen size={13} strokeWidth={2} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-[#1F1D17]">
              <ScrumTooltip keyword="Sprint Retrospective" text="會議宗旨 (Sprint Retrospective)" />
            </span>
          </div>
          <div className="px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            {['檢視 DoD + AC', '增加產出品質', '提升團隊效能'].map((item, i) => (
              <span key={i} className="flex items-center gap-1.5 text-sm text-[#5A574E] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C96442] flex-shrink-0" />
                {item}
              </span>
            ))}
          </div>
        </section>

        {/* 背景音樂播放器 */}
        <section className="bg-white border border-[#E9E5DA] rounded-xl overflow-hidden">
          <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-5 py-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#467386] flex items-center justify-center flex-shrink-0">
              <Music size={13} strokeWidth={2} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-[#1F1D17]">背景音樂</span>
            <span className="text-xs text-[#8B887E] ml-1">— 貼上 YouTube 連結，讓會議更輕鬆</span>
          </div>
          <div className="p-5 flex flex-col gap-3">
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="text"
                className="flex-1 min-w-[240px] px-4 py-2.5 bg-white border border-[#E9E5DA] rounded-[9px] focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] text-[#1F1D17] text-sm placeholder:text-[#B5B2A6]"
                placeholder="貼上 YouTube 連結，例如：https://www.youtube.com/watch?v=..."
                value={urlInput}
                onChange={e => { setUrlInput(e.target.value); setMusicError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handlePlayMusic(); }}
              />
              <button
                onClick={handlePlayMusic}
                className="inline-flex items-center gap-1.5 bg-[#1F1D17] text-white px-4 py-2.5 rounded-[9px] text-sm font-semibold hover:bg-[#3D3B35] hover:shadow-sm hover:-translate-y-[1px] transition-all duration-150 whitespace-nowrap"
              >
                <Play size={13} strokeWidth={2} /> 播放
              </button>
              {embedId && (
                <button
                  onClick={handleStopMusic}
                  className="inline-flex items-center gap-1.5 border border-[#B8543C] text-[#B8543C] px-4 py-2.5 rounded-[9px] text-sm font-semibold hover:bg-[#F0DDD3] hover:-translate-y-[1px] transition-all duration-150 whitespace-nowrap"
                >
                  <Square size={11} strokeWidth={2} /> 停止
                </button>
              )}
            </div>
            {musicError && (
              <div className="text-xs text-[#B8543C]">⚠ {musicError}</div>
            )}
            {embedId && (
              <>
                <div className="flex items-center gap-2 text-xs text-[#5A574E]">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#C96442] animate-pulse" />
                  正在播放背景音樂中...
                </div>
                <iframe
                  key={embedId}
                  src={`https://www.youtube.com/embed/${embedId}?autoplay=1&loop=1&playlist=${embedId}&rel=0`}
                  allow="autoplay; encrypted-media"
                  style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
                />
              </>
            )}
          </div>
        </section>

        {/* 倒數計時器 */}
        <CountdownTimer defaultMinutes={2} presets={[45, 90, 135, 180]} />

        {/* 上一次的行動 */}
        <section className="bg-white border border-[#E9E5DA] rounded-xl overflow-hidden">
          <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-5 py-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#8B5A2B] flex items-center justify-center flex-shrink-0">
              <FileText size={13} strokeWidth={2} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-[#1F1D17]">上一次的行動</span>
            <span className="text-xs text-[#8B887E] ml-1">（回顧上個 Sprint 承諾的行動項目）</span>
          </div>
          <div className="p-5">
            <AutoGrowTextarea
              className="block w-full px-4 py-3 bg-white border border-[#E9E5DA] rounded-[9px] focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] text-[#1F1D17] text-sm placeholder:text-[#B5B2A6] resize-none min-h-[120px] overflow-hidden whitespace-pre-wrap break-words"
              placeholder="貼上或記錄上一次 Sprint 承諾的行動項目，作為本次回顧的對照基準..."
              value={data.previousActions}
              onChange={e => updateData({ previousActions: e.target.value })}
            />
          </div>
        </section>

        {/* 三大回顧區塊 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

          {/* Keep / Start */}
          <section className="bg-white border border-[#E9E5DA] border-l-[3px] border-l-[#4F7E5C] rounded-xl overflow-hidden hover:shadow-sm transition-all duration-150">
            <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-4 py-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4F7E5C] flex-shrink-0" />
              <div className="w-6 h-6 rounded-md bg-[#4F7E5C] flex items-center justify-center flex-shrink-0">
                <Sprout size={13} strokeWidth={2} className="text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#1F1D17] leading-tight">什麼做得好？</div>
                <div className="text-[10px] text-[#8B887E]">Keep / Start</div>
              </div>
            </div>
            <div className="p-4">
              <AutoGrowTextarea
                className={taClass}
                placeholder="記錄團隊本次表現優異、值得保留或開始嘗試的作法..."
                value={data.keepStart}
                onChange={e => updateData({ keepStart: e.target.value })}
              />
            </div>
          </section>

          {/* Problem / Stop */}
          <section className="bg-white border border-[#E9E5DA] border-l-[3px] border-l-[#B8543C] rounded-xl overflow-hidden hover:shadow-sm transition-all duration-150">
            <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-4 py-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B8543C] flex-shrink-0" />
              <div className="w-6 h-6 rounded-md bg-[#B8543C] flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={13} strokeWidth={2} className="text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#1F1D17] leading-tight">什麼需要改善？</div>
                <div className="text-[10px] text-[#8B887E]">Problem / Stop</div>
              </div>
            </div>
            <div className="p-4">
              <AutoGrowTextarea
                className={taClass}
                placeholder="記錄遇到的阻礙、問題或需要停止的不良習慣..."
                value={data.problemStop}
                onChange={e => updateData({ problemStop: e.target.value })}
              />
            </div>
          </section>

          {/* Action Items */}
          <section className="bg-white border border-[#E9E5DA] border-l-[3px] border-l-[#C96442] rounded-xl overflow-hidden hover:shadow-sm transition-all duration-150">
            <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-4 py-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#C96442] flex-shrink-0" />
              <div className="w-6 h-6 rounded-md bg-[#C96442] flex items-center justify-center flex-shrink-0">
                <Zap size={13} strokeWidth={2} className="text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#1F1D17] leading-tight">挑戰最大效益來改</div>
                <div className="text-[10px] text-[#8B887E]">Action Items</div>
              </div>
            </div>
            <div className="p-4">
              <AutoGrowTextarea
                className={taClass}
                placeholder="列出下個 Sprint 的具體改進行動項目..."
                value={data.actionItems}
                onChange={e => updateData({ actionItems: e.target.value })}
              />
            </div>
          </section>

        </div>

        {/* 下一個 Sprint 行動進度追蹤人 */}
        <section className="bg-white border border-[#E9E5DA] rounded-xl overflow-hidden">
          <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-5 py-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#C96442] flex items-center justify-center flex-shrink-0">
              <Target size={13} strokeWidth={2} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-[#1F1D17]">下一個 Sprint 行動進度追蹤人</span>
          </div>
          <div className="p-5">
            <input
              type="text"
              className="w-full px-4 py-3 bg-white border border-[#E9E5DA] rounded-[9px] focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] text-[#1F1D17] text-sm placeholder:text-[#B5B2A6]"
              placeholder="輸入負責追蹤行動進度的成員名稱..."
              value={data.actionTracker}
              onChange={e => updateData({ actionTracker: e.target.value })}
            />
          </div>
        </section>

        {/* 歷次改善行動彙總（唯讀，跨 Sprint） */}
        <ActionItemsDigest sprints={allSprints} currentSprintId={currentSprintId} />

        <div className="flex justify-end pt-2">
          <button className="inline-flex items-center gap-2 bg-[#C96442] text-white px-8 py-3 rounded-[9px] font-semibold text-sm hover:bg-[#7A3520] hover:shadow-md hover:-translate-y-[1px] transition-all duration-150">
            <CheckCircle2 size={16} strokeWidth={1.75} /> 結束本次 Sprint 並存檔
          </button>
        </div>

      </div>
    </main>
  );
}
