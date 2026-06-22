"use client";

import React, { useState, useRef } from 'react';
import { useAutoSave } from '@/hooks/useAutoSave';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import ScrumTooltip from '@/components/ScrumTooltip';
import SaveIndicator from '@/components/SaveIndicator';
import CountdownTimer from '@/components/CountdownTimer';

type SummaryLevel = '詳細' | '適中' | '精簡';

function VoiceTextSection({
  value,
  onChange,
  placeholder,
  fieldName,
  rows = 3,
  textareaClass = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  fieldName: string;
  rows?: number;
  textareaClass?: string;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeLevel, setActiveLevel] = useState<SummaryLevel | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const startWaveform = (stream: MediaStream) => {
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      analyser.getByteTimeDomainData(dataArray);
      const W = canvas.width; const H = canvas.height;
      ctx.fillStyle = '#1a2e1f';
      ctx.fillRect(0, 0, W, H);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#8fb996';
      ctx.shadowColor = '#8fb996';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      const sw = W / dataArray.length;
      let x = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const y = (dataArray[i] / 128.0) * (H / 2);
        if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
        x += sw;
      }
      ctx.lineTo(W, H / 2);
      ctx.stroke();
    };
    draw();
  };

  const stopWaveform = () => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    analyserRef.current = null;
    // 清空 canvas
    const canvas = canvasRef.current;
    if (canvas) { const ctx = canvas.getContext('2d'); if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        stopWaveform();
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAndAppend(blob);
      };
      mr.start();
      startWaveform(stream);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch {
      alert('無法存取麥克風，請確認瀏覽器已授予麥克風權限。');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
  };

  const transcribeAndAppend = async (blob: Blob) => {
    const apiKey = localStorage.getItem('openai_api_key');
    if (!apiKey) {
      alert('⚠️ 請先在 Sprint Planning 頁面設定 AI 魔法鑰匙 (API Key)');
      return;
    }
    setIsTranscribing(true);
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'audio.webm');
      fd.append('apiKey', apiKey);
      const res = await fetch('/api/ai-transcribe', { method: 'POST', body: fd });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || '轉錄失敗'); }
      const data = await res.json();
      const text = (data.text || '').trim();
      if (text) onChange(value ? value + '\n' + text : text);
    } catch (err: unknown) {
      alert('轉錄失敗：' + ((err as Error).message || '未知錯誤'));
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleAISummarize = async (level: SummaryLevel) => {
    const apiKey = localStorage.getItem('openai_api_key');
    if (!apiKey) {
      alert('請先在 Sprint Planning 頁面設定 AI 魔法鑰匙 (API Key)');
      return;
    }
    if (!value.trim()) {
      alert('請先輸入或錄音一些內容，再使用 AI 歸納');
      return;
    }
    setIsProcessing(true);
    setActiveLevel(level);
    try {
      const res = await fetch('/api/ai-voice-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, text: value, level, fieldName }),
      });
      const data = await res.json();
      if (data.result) onChange(data.result);
      else if (data.error) alert('AI 錯誤：' + data.error);
    } catch {
      alert('AI 處理失敗，請稍後再試');
    } finally {
      setIsProcessing(false);
      setActiveLevel(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className={textareaClass}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />

      {/* 錄音波形 */}
      {isRecording && (
        <canvas
          ref={canvasRef}
          width={600}
          height={48}
          className="w-full rounded-xl border-2 border-[#5b755e] bg-[#1a2e1f]"
        />
      )}

      {/* 轉錄中提示 */}
      {isTranscribing && (
        <div className="px-3 py-2 bg-[#e8eedd] border-2 border-[#8fb996] rounded-xl text-sm text-[#5b755e] font-bold flex items-center gap-2">
          <span className="inline-block w-3 h-3 border-2 border-[#5b755e] border-t-transparent rounded-full animate-spin" />
          AI 轉錄中，請稍候...
        </div>
      )}

      {/* 控制列 */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isTranscribing}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold border-2 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed
            ${isRecording
              ? 'bg-[#e07a5f] text-white border-[#c66147] animate-pulse'
              : 'bg-[#f4f1ea] text-[#8a4231] border-[#d4b896] hover:bg-[#ffe8e0] hover:border-[#e07a5f]'
            }`}
        >
          {isRecording ? `⏹ 停止錄音 ${formatTime(recordingTime)}` : '🎙 錄音'}
        </button>

        {value.trim() && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-[#8a7f72] font-bold whitespace-nowrap">✨ AI 歸納：</span>
            {(['詳細', '適中', '精簡'] as SummaryLevel[]).map(level => (
              <button
                key={level}
                onClick={() => handleAISummarize(level)}
                disabled={isProcessing}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all shadow-sm whitespace-nowrap
                  ${isProcessing && activeLevel === level
                    ? 'bg-[#5b755e] text-white border-[#4a6350]'
                    : 'bg-[#e8eedd] text-[#4a7c59] border-[#8fb996] hover:bg-[#dcedc1] disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
              >
                {isProcessing && activeLevel === level ? '處理中...' : level}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SprintReview() {
  const { data, updateData, loading, saveStatus } = useAutoSave('review', {
    opening: '',
    demo: '',
    market: '',
    future: ''
  });

  return (
    <main className="min-h-screen bg-[#f4f1ea] p-8 font-serif text-[#3e362e] bg-[url('https://www.transparenttextures.com/patterns/rice-paper-2.png')]">
      <div className="w-full space-y-8">

        <div className="flex items-center justify-between">
          <Navigation />
          <SaveIndicator status={saveStatus} />
        </div>

        {loading && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"><div className="bg-white px-6 py-4 rounded-xl font-bold text-[#5b755e] shadow-xl text-lg flex items-center gap-3"><span>💾</span> <span>載入資料中...</span></div></div>}

        <CountdownTimer />

        <section className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-xl overflow-hidden relative">
          <div className="bg-[#d4a373] border-b-4 border-[#5b755e] p-4 text-xl font-bold text-white tracking-wider flex justify-between items-center drop-shadow-sm">
            <div className="flex items-center gap-2">
              <span>🌻</span> <ScrumTooltip keyword="Sprint Review" text="向利益關係人展示成果 (Sprint Review)" />
            </div>
            <div className="bg-[#8b5a2b] px-3 py-1 rounded-lg text-sm">
              依 Sprint 週期限時
            </div>
          </div>

          <div className="p-8 space-y-8">

            {/* 開場 (10%) */}
            <div className="flex flex-col gap-2 relative">
              <div className="absolute -left-4 top-2 w-2 h-full bg-[#e07a5f] rounded-full"></div>
              <label className="font-bold text-xl text-[#8a4231] flex items-center gap-2">
                <span>🎤</span> 開場與進度總結 (10%)
                <span className="text-sm font-bold bg-[#fceded] text-[#c96262] px-2 py-0.5 rounded border border-[#e6b1b1]">PO 負責</span>
              </label>
              <VoiceTextSection
                value={data.opening}
                onChange={v => updateData({ opening: v })}
                placeholder="總結本次 Sprint 的目標達成狀況..."
                fieldName="開場與進度總結"
                rows={3}
                textareaClass="w-full mt-2 px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#d4a373]/50 shadow-inner font-medium text-[#3e362e] transition-all"
              />
            </div>

            {/* 展示 (50%) */}
            <div className="flex flex-col gap-2 relative">
              <div className="absolute -left-4 top-2 w-2 h-full bg-[#8fb996] rounded-full"></div>
              <label className="font-bold text-xl text-[#4a7c59] flex items-center gap-2">
                <span>✨</span> 成果演示與體驗 (50%)
              </label>
              <VoiceTextSection
                value={data.demo}
                onChange={v => updateData({ demo: v })}
                placeholder="記錄展示的具體功能與現場反饋..."
                fieldName="成果演示與體驗"
                rows={5}
                textareaClass="w-full mt-2 px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner font-medium text-[#3e362e] transition-all min-h-[150px]"
              />
            </div>

            {/* 市場與現況 (20%) */}
            <div className="flex flex-col gap-2 relative">
              <div className="absolute -left-4 top-2 w-2 h-full bg-[#76a5af] rounded-full"></div>
              <label className="font-bold text-xl text-[#467386] flex items-center gap-2">
                <span>🌍</span> 市場與現況討論 (20%)
                <span className="text-sm font-bold bg-[#fceded] text-[#c96262] px-2 py-0.5 rounded border border-[#e6b1b1]">PO 負責</span>
              </label>
              <VoiceTextSection
                value={data.market}
                onChange={v => updateData({ market: v })}
                placeholder="討論市場變化、業務需求調整..."
                fieldName="市場與現況討論"
                rows={3}
                textareaClass="w-full mt-2 px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#76a5af]/50 shadow-inner font-medium text-[#3e362e] transition-all"
              />
            </div>

            {/* 展望未來 (20%) */}
            <div className="flex flex-col gap-2 relative">
              <div className="absolute -left-4 top-2 w-2 h-full bg-[#d3cbbd] rounded-full"></div>
              <label className="font-bold text-xl text-[#6b5e50] flex items-center gap-2">
                <span>🔭</span> 展望未來 (20%)
                <span className="text-sm font-bold bg-[#e8e4d9] text-[#6b5e50] px-2 py-0.5 rounded border border-[#b5a695]">調查品清單</span>
              </label>
              <VoiceTextSection
                value={data.future}
                onChange={v => updateData({ future: v })}
                placeholder="為下個 Sprint 或長期目標的建議..."
                fieldName="展望未來"
                rows={3}
                textareaClass="w-full mt-2 px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#b5a695]/50 shadow-inner font-medium text-[#3e362e] transition-all"
              />
            </div>

          </div>
        </section>

        <div className="flex justify-end pt-4">
          <Link href="/retrospective" className="bg-[#e07a5f] text-white px-8 py-3 rounded-full font-bold text-lg hover:bg-[#c66147] hover:-translate-y-1 transition-all duration-200 shadow-lg border-2 border-[#8a4231] inline-flex items-center gap-2">
            <span>🚂</span> 前往 Sprint Retrospective (回顧會議)
          </Link>
        </div>

      </div>
    </main>
  );
}
