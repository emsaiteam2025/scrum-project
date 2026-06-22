"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

interface TimerCtx {
  minutes: number;
  remaining: number;
  isRunning: boolean;
  finished: boolean;
  floatVisible: boolean;
  applyMinutes: (m: number) => void;
  reset: () => void;
  toggleRun: () => void;
  setFloatVisible: (v: boolean | ((prev: boolean) => boolean)) => void;
}

const TimerContext = createContext<TimerCtx | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [minutes, setMinutes] = useState(15);
  const [remaining, setRemaining] = useState(15 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [floatVisible, setFloatVisible] = useState(false);

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
                setTimeout(() => o.stop(), 250);
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

  const toggleRun = () => {
    if (finished) { reset(); return; }
    setIsRunning(r => !r);
  };

  return (
    <TimerContext.Provider value={{ minutes, remaining, isRunning, finished, floatVisible, applyMinutes, reset, toggleRun, setFloatVisible }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within TimerProvider');
  return ctx;
}
