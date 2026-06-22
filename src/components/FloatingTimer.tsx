"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useTimer } from '@/contexts/TimerContext';

export default function FloatingTimer() {
  const { minutes, remaining, isRunning, finished, floatVisible, reset, toggleRun, setFloatVisible } = useTimer();

  const floatRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: -1, y: -1 });

  useEffect(() => {
    if (floatVisible && pos.x === -1) {
      setPos({ x: window.innerWidth - 220, y: window.innerHeight - 180 });
    }
  }, [floatVisible, pos.x]);

  const onMouseDown = (e: React.MouseEvent) => {
    const rect = floatRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragOffset.current) return;
      const newX = Math.max(0, Math.min(window.innerWidth - 200, e.clientX - dragOffset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 120, e.clientY - dragOffset.current.y));
      setPos({ x: newX, y: newY });
    };
    const onUp = () => { dragOffset.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  if (!floatVisible || pos.x === -1) return null;

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const pct = minutes > 0 ? Math.round((1 - remaining / (minutes * 60)) * 100) : 0;
  const urgentColor = finished ? '#c96262' : remaining <= 60 ? '#e07a5f' : '#467386';

  return (
    <div
      ref={floatRef}
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999, userSelect: 'none' }}
      className={`rounded-2xl shadow-2xl border-4 w-48 overflow-hidden transition-colors ${finished ? 'border-[#c96262] bg-[#fceded]' : remaining <= 60 ? 'border-[#e07a5f] bg-[#fff8f6]' : 'border-[#76a5af] bg-[#fffdf9]'}`}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className={`flex items-center justify-between px-3 py-1.5 cursor-grab active:cursor-grabbing select-none ${finished ? 'bg-[#c96262]' : remaining <= 60 ? 'bg-[#e07a5f]' : 'bg-[#76a5af]'}`}
      >
        <span className="text-white text-xs font-bold">⏳ 計時器</span>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={() => setFloatVisible(false)}
          className="text-white opacity-80 hover:opacity-100 text-sm font-bold leading-none px-1"
        >
          ✕
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[#e8e4d9]">
        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: urgentColor }} />
      </div>

      {/* Time */}
      <div className="px-4 py-3 text-center">
        <div className={`text-4xl font-mono font-bold tabular-nums ${finished ? 'text-[#c96262] animate-pulse' : remaining <= 60 ? 'text-[#e07a5f]' : 'text-[#467386]'}`}>
          {mm}:{ss}
        </div>
        {finished
          ? <div className="text-xs font-bold text-[#c96262] mt-0.5">⏰ 時間到！</div>
          : <div className="text-[10px] text-[#8a7f72] mt-0.5">{minutes} 分鐘 · {pct}% 已用</div>
        }
      </div>

      {/* Controls */}
      <div className="flex gap-1.5 px-3 pb-3">
        <button
          onClick={toggleRun}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold text-white transition-colors ${isRunning ? 'bg-[#d4a373] hover:bg-[#b8895a]' : 'bg-[#8fb996] hover:bg-[#78a07e]'}`}
        >
          {isRunning ? '⏸' : finished ? '🔄' : '▶'}
        </button>
        <button
          onClick={reset}
          className="flex-1 py-1.5 rounded-lg text-xs font-bold text-[#5b755e] bg-[#e8eedd] hover:bg-[#dcedc1] transition-colors"
        >
          重設
        </button>
      </div>
    </div>
  );
}
