"use client";

import React from 'react';
import { useTimer } from '@/contexts/TimerContext';
import { Clock, Play, Pause, RotateCcw, Pin } from 'lucide-react';

export default function CountdownTimer({
  presets = [5, 10, 15, 30],
}: {
  defaultMinutes?: number;
  presets?: number[];
}) {
  const { minutes, remaining, isRunning, finished, floatVisible, applyMinutes, reset, toggleRun, setFloatVisible } = useTimer();

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <section className={`bg-white rounded-xl p-5 flex flex-col lg:flex-row items-center justify-between gap-5 transition-colors ${
      finished ? 'border border-[#B8543C] bg-[#F0DDD3]' : 'border border-[#E9E5DA]'
    }`}>
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          finished ? 'bg-[#B8543C]' : 'bg-[#C96442]'
        }`}>
          <Clock size={18} strokeWidth={1.75} className="text-white" />
        </div>
        <div>
          <div className="text-xs font-semibold text-[#8B887E] uppercase tracking-wide">會議倒數計時</div>
          <div className={`text-5xl font-mono font-bold tabular-nums leading-tight ${
            finished ? 'text-[#B8543C] animate-pulse' : 'text-[#1F1D17]'
          }`}>
            {mm}:{ss}
          </div>
          {finished && (
            <div className="text-xs font-semibold text-[#B8543C] mt-1 flex items-center gap-1">
              <Clock size={11} strokeWidth={1.75} />
              時間到！
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <label className="flex items-center gap-2 text-sm text-[#5A574E]">
          設定
          <input
            type="number"
            min="1"
            max="180"
            value={minutes}
            disabled={isRunning}
            onChange={e => applyMinutes(Number(e.target.value))}
            className="w-20 px-3 py-2 bg-white border border-[#D8D3C5] rounded-lg text-center font-mono text-[#1F1D17] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#F5E4DA]"
          />
          分鐘
        </label>

        <div className="flex gap-1">
          {presets.map(m => (
            <button
              key={m}
              onClick={() => applyMinutes(m)}
              disabled={isRunning}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                minutes === m && !isRunning
                  ? 'bg-[#C96442] text-white border-[#C96442]'
                  : 'border-[#E9E5DA] text-[#5A574E] hover:border-[#D8D3C5] hover:bg-[#F6F3EB]'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {m}分
            </button>
          ))}
        </div>

        <button
          onClick={toggleRun}
          className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-[9px] font-semibold text-sm text-white transition-all hover:shadow-sm hover:-translate-y-[1px] ${
            isRunning ? 'bg-[#B8893A] hover:bg-[#7a5c00]' : 'bg-[#1F1D17] hover:bg-[#5A574E]'
          }`}
        >
          {isRunning
            ? <><Pause size={14} strokeWidth={1.75} /> 暫停</>
            : finished
              ? <><RotateCcw size={14} strokeWidth={1.75} /> 重設</>
              : <><Play size={14} strokeWidth={1.75} /> 開始</>
          }
        </button>

        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[9px] text-sm text-[#5A574E] bg-white border border-[#E9E5DA] hover:bg-[#F6F3EB] transition-colors"
        >
          <RotateCcw size={13} strokeWidth={1.75} />
          重設
        </button>

        <button
          onClick={() => setFloatVisible(v => !v)}
          title={floatVisible ? '關閉懸浮計時器' : '開啟懸浮計時器'}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-[9px] text-sm border transition-all ${
            floatVisible
              ? 'bg-[#C96442] text-white border-[#C96442]'
              : 'bg-white text-[#5A574E] border-[#E9E5DA] hover:bg-[#F6F3EB]'
          }`}
        >
          <Pin size={13} strokeWidth={1.75} />
          懸浮
        </button>
      </div>
    </section>
  );
}
