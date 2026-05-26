"use client";

import React, { useEffect, useState } from 'react';

export default function CountdownTimer({
  defaultMinutes = 15,
  presets = [5, 10, 15, 30],
}: {
  defaultMinutes?: number;
  presets?: number[];
}) {
  const [minutes, setMinutes] = useState<number>(defaultMinutes);
  const [remaining, setRemaining] = useState<number>(defaultMinutes * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [finished, setFinished] = useState<boolean>(false);

  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          setIsRunning(false);
          setFinished(true);
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const AC = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AC();
            [0, 350, 700].forEach(delay => {
              setTimeout(() => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.connect(g); g.connect(ctx.destination);
                o.frequency.value = 880;
                g.gain.value = 0.25;
                o.start();
                setTimeout(() => { o.stop(); }, 250);
              }, delay);
            });
            setTimeout(() => { try { ctx.close(); } catch {} }, 1500);
          } catch {}
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [isRunning]);

  const applyMinutes = (m: number) => {
    const safe = Math.max(1, Math.min(180, Math.floor(m) || 1));
    setMinutes(safe);
    setRemaining(safe * 60);
    setIsRunning(false);
    setFinished(false);
  };

  const reset = () => {
    setRemaining(minutes * 60);
    setIsRunning(false);
    setFinished(false);
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <section className={`bg-[#fffdf9] border-4 rounded-3xl shadow-lg p-6 flex flex-col lg:flex-row items-center justify-between gap-5 transition-colors ${finished ? 'border-[#c96262] bg-[#fceded]' : 'border-[#76a5af]'}`}>
      <div className="flex items-center gap-4">
        <span className="text-4xl">⏳</span>
        <div>
          <div className="text-sm font-bold text-[#6b5e50] tracking-wide">會議倒數計時</div>
          <div className={`text-5xl font-mono font-bold tabular-nums leading-tight ${finished ? 'text-[#c96262] animate-pulse' : 'text-[#467386]'}`}>
            {mm}:{ss}
          </div>
          {finished && <div className="text-sm font-bold text-[#c96262] mt-1">⏰ 時間到！</div>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <label className="flex items-center gap-2 text-sm font-bold text-[#6b5e50]">
          設定
          <input
            type="number"
            min="1"
            max="180"
            value={minutes}
            disabled={isRunning}
            onChange={e => applyMinutes(Number(e.target.value))}
            className="w-20 px-3 py-2 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl text-center font-bold text-[#3e362e] disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-[#76a5af]/40"
          />
          分鐘
        </label>

        <div className="flex gap-1">
          {presets.map(m => (
            <button
              key={m}
              onClick={() => applyMinutes(m)}
              disabled={isRunning}
              className={`px-3 py-2 rounded-lg text-sm font-bold border-2 transition-colors ${minutes === m && !isRunning ? 'bg-[#76a5af] text-white border-[#467386]' : 'bg-[#e8e4d9] text-[#3e362e] border-[#b5a695] hover:bg-[#d4cdbe]'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {m}分
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            if (finished) { reset(); return; }
            setIsRunning(r => !r);
          }}
          className={`px-5 py-2 rounded-xl font-bold text-white border-2 shadow transition-all hover:-translate-y-0.5 ${isRunning ? 'bg-[#d4a373] border-[#8b5a2b] hover:bg-[#b8895a]' : 'bg-[#8fb996] border-[#5b755e] hover:bg-[#78a07e]'}`}
        >
          {isRunning ? '⏸ 暫停' : finished ? '🔄 重設' : '▶ 開始'}
        </button>

        <button
          onClick={reset}
          className="px-4 py-2 rounded-xl font-bold text-[#3e362e] bg-[#fffdf9] border-2 border-[#b5a695] hover:bg-[#f1ece3] transition-colors"
        >
          重設
        </button>
      </div>
    </section>
  );
}
