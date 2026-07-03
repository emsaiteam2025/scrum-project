"use client";

import React, { useState, useRef } from 'react';
import { useAutoSave } from '@/hooks/useAutoSave';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import ScrumTooltip from '@/components/ScrumTooltip';
import SaveIndicator from '@/components/SaveIndicator';
import CountdownTimer from '@/components/CountdownTimer';
import { Mic, Square, Sparkles, Globe, TrendingUp, Target, ArrowRight, Save } from 'lucide-react';

type SummaryLevel = '詳細' | '適中' | '精簡';

// 每 5 分鐘自動分段上傳，確保不超過 API 大小限制（Whisper 25MB / Gemini 20MB）
const AUTO_FLUSH_MS = 5 * 60 * 1000;

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
  const [isAutoTranscribing, setIsAutoTranscribing] = useState(false);
  const [segmentCount, setSegmentCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeLevel, setActiveLevel] = useState<SummaryLevel | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  // 始終指向最新的 value，避免閉包過舊問題
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

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
      ctx.fillStyle = '#1F1D17';
      ctx.fillRect(0, 0, W, H);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#C96442';
      ctx.shadowColor = '#C96442';
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
    const canvas = canvasRef.current;
    if (canvas) { const ctx = canvas.getContext('2d'); if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); }
  };

  // silent=true 時在背景靜默執行（自動分段），不顯示 isTranscribing spinner
  const transcribeAndAppend = async (blob: Blob, silent = false) => {
    if (blob.size < 5000) return; // 小於 5KB 視為無聲，跳過
    const apiKey = localStorage.getItem('openai_api_key');
    if (!apiKey) {
      if (!silent) alert('⚠️ 請先在 Sprint Planning 頁面設定 AI 魔法鑰匙 (API Key)');
      return;
    }
    if (!silent) setIsTranscribing(true);
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'audio.webm');
      fd.append('apiKey', apiKey);
      const res = await fetch('/api/ai-transcribe', { method: 'POST', body: fd });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || '轉錄失敗'); }
      const data = await res.json();
      const text = (data.text || '').trim();
      // 使用 valueRef 確保多段同時完成時不會互相覆蓋
      if (text) {
        const current = valueRef.current;
        onChange(current ? current + '\n' + text : text);
      }
    } catch (err: unknown) {
      if (!silent) alert('轉錄失敗：' + ((err as Error).message || '未知錯誤'));
      else console.error('[auto-flush transcribe]', err);
    } finally {
      if (!silent) setIsTranscribing(false);
    }
  };

  // 自動分段：將目前緩衝的 chunks 打包送出，清空後繼續錄
  const flushAudio = async () => {
    if (audioChunksRef.current.length === 0) return;
    const chunks = audioChunksRef.current.splice(0); // 原子取出並清空
    const blob = new Blob(chunks, { type: 'audio/webm' });
    setIsAutoTranscribing(true);
    try {
      await transcribeAndAppend(blob, true);
      setSegmentCount(c => c + 1);
    } finally {
      setIsAutoTranscribing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      // timeslice=1000：每秒觸發一次 ondataavailable，讓 flush 可以精確在 5 分鐘切割
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        stopWaveform();
        // 停止後把最後一段剩餘音訊送出
        const remaining = audioChunksRef.current.splice(0);
        const blob = new Blob(remaining, { type: 'audio/webm' });
        await transcribeAndAppend(blob, false);
      };
      mr.start(1000);
      // 每 5 分鐘自動 flush
      flushTimerRef.current = setInterval(flushAudio, AUTO_FLUSH_MS);
      startWaveform(stream);
      setIsRecording(true);
      setRecordingTime(0);
      setSegmentCount(0);
      timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch {
      alert('無法存取麥克風，請確認瀏覽器已授予麥克風權限。');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (flushTimerRef.current) { clearInterval(flushTimerRef.current); flushTimerRef.current = null; }
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
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
          className="w-full rounded-lg border border-[#E9E5DA]"
        />
      )}

      {/* 轉錄中提示 */}
      {isTranscribing && (
        <div className="px-3 py-2 bg-[#DDE6D9] border border-[#4F7E5C] rounded-lg text-sm text-[#4F7E5C] font-medium flex items-center gap-2">
          <span className="inline-block w-3 h-3 border border-[#4F7E5C] border-t-transparent rounded-full animate-spin" />
          AI 轉錄中，請稍候...
        </div>
      )}
      {/* 自動分段背景轉錄提示 */}
      {isAutoTranscribing && (
        <div className="px-3 py-2 bg-[#F6F3EB] border border-[#E9E5DA] rounded-lg text-xs text-[#8B887E] flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 border border-[#8B887E] border-t-transparent rounded-full animate-spin" />
          背景轉錄第 {segmentCount + 1} 段中（錄音繼續進行）...
        </div>
      )}
      {isRecording && segmentCount > 0 && !isAutoTranscribing && (
        <div className="px-3 py-1.5 bg-[#F6F3EB] border border-[#E9E5DA] rounded-lg text-[11px] text-[#8B887E] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4F7E5C]" />
          已完成 {segmentCount} 段自動轉錄，繼續錄音中...
        </div>
      )}

      {/* 控制列 */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isTranscribing}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed
            ${isRecording
              ? 'bg-[#B8543C] text-white border-[#B8543C] animate-pulse'
              : 'border-[#C96442] text-[#C96442] hover:bg-[#F5E4DA]'
            }`}
        >
          {isRecording
            ? <><Square size={11} strokeWidth={1.75} /> 停止錄音 {formatTime(recordingTime)}</>
            : <><Mic size={13} strokeWidth={1.75} /> 錄音</>
          }
        </button>

        {value.trim() && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-[#8B887E] whitespace-nowrap flex items-center gap-1">
              <Sparkles size={11} strokeWidth={1.75} /> AI 歸納：
            </span>
            {(['詳細', '適中', '精簡'] as SummaryLevel[]).map(level => (
              <button
                key={level}
                onClick={() => handleAISummarize(level)}
                disabled={isProcessing}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all whitespace-nowrap
                  ${isProcessing && activeLevel === level
                    ? 'bg-[#1F1D17] text-white border-[#1F1D17]'
                    : 'bg-[#F6F3EB] text-[#5A574E] border-[#E9E5DA] hover:bg-[#F1EEE6] disabled:opacity-50 disabled:cursor-not-allowed'
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

  const taClass = "w-full px-4 py-3 bg-white border border-[#E9E5DA] rounded-[9px] focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] text-[#1F1D17] text-sm placeholder:text-[#B5B2A6] resize-none transition-all";

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

        <CountdownTimer />

        {/* Sprint Review 主區塊 */}
        <section className="bg-white border border-[#E9E5DA] rounded-xl overflow-hidden">
          {/* Section Header */}
          <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-5 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#C96442] flex items-center justify-center flex-shrink-0">
                <Target size={13} strokeWidth={2} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-[#1F1D17]">
                <ScrumTooltip keyword="Sprint Review" text="向利益關係人展示成果 (Sprint Review)" />
              </span>
            </div>
            <span className="text-xs text-[#8B887E] bg-[#F1EEE6] px-2.5 py-1 rounded-lg">依 Sprint 週期限時</span>
          </div>

          <div className="p-5 space-y-4">

            {/* 開場 10% */}
            <div className="border border-[#E9E5DA] border-l-[3px] border-l-[#C96442] rounded-xl overflow-hidden">
              <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-4 py-3 flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-[#C96442] flex items-center justify-center flex-shrink-0">
                  <Mic size={13} strokeWidth={2} className="text-white" />
                </div>
                <span className="text-sm font-semibold text-[#1F1D17]">開場與進度總結</span>
                <span className="text-[10px] font-mono bg-[#F1EEE6] text-[#8B887E] px-1.5 py-0.5 rounded">10%</span>
                <span className="text-[10px] bg-[#F5E4DA] text-[#7A3520] px-2 py-0.5 rounded ml-0.5">PO 負責</span>
              </div>
              <div className="p-4">
                <VoiceTextSection
                  value={data.opening}
                  onChange={v => updateData({ opening: v })}
                  placeholder="總結本次 Sprint 的目標達成狀況..."
                  fieldName="開場與進度總結"
                  rows={3}
                  textareaClass={taClass}
                />
              </div>
            </div>

            {/* 展示 50% */}
            <div className="border border-[#E9E5DA] border-l-[3px] border-l-[#4F7E5C] rounded-xl overflow-hidden">
              <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-4 py-3 flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-[#4F7E5C] flex items-center justify-center flex-shrink-0">
                  <Sparkles size={13} strokeWidth={2} className="text-white" />
                </div>
                <span className="text-sm font-semibold text-[#1F1D17]">成果演示與體驗</span>
                <span className="text-[10px] font-mono bg-[#F1EEE6] text-[#8B887E] px-1.5 py-0.5 rounded">50%</span>
              </div>
              <div className="p-4">
                <VoiceTextSection
                  value={data.demo}
                  onChange={v => updateData({ demo: v })}
                  placeholder="記錄展示的具體功能與現場反饋..."
                  fieldName="成果演示與體驗"
                  rows={5}
                  textareaClass={taClass + ' min-h-[150px]'}
                />
              </div>
            </div>

            {/* 市場 20% */}
            <div className="border border-[#E9E5DA] border-l-[3px] border-l-[#467386] rounded-xl overflow-hidden">
              <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-4 py-3 flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-[#467386] flex items-center justify-center flex-shrink-0">
                  <Globe size={13} strokeWidth={2} className="text-white" />
                </div>
                <span className="text-sm font-semibold text-[#1F1D17]">市場與現況討論</span>
                <span className="text-[10px] font-mono bg-[#F1EEE6] text-[#8B887E] px-1.5 py-0.5 rounded">20%</span>
                <span className="text-[10px] bg-[#F5E4DA] text-[#7A3520] px-2 py-0.5 rounded ml-0.5">PO 負責</span>
              </div>
              <div className="p-4">
                <VoiceTextSection
                  value={data.market}
                  onChange={v => updateData({ market: v })}
                  placeholder="討論市場變化、業務需求調整..."
                  fieldName="市場與現況討論"
                  rows={3}
                  textareaClass={taClass}
                />
              </div>
            </div>

            {/* 展望 20% */}
            <div className="border border-[#E9E5DA] border-l-[3px] border-l-[#8B887E] rounded-xl overflow-hidden">
              <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-4 py-3 flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-[#8B887E] flex items-center justify-center flex-shrink-0">
                  <TrendingUp size={13} strokeWidth={2} className="text-white" />
                </div>
                <span className="text-sm font-semibold text-[#1F1D17]">展望未來</span>
                <span className="text-[10px] font-mono bg-[#F1EEE6] text-[#8B887E] px-1.5 py-0.5 rounded">20%</span>
                <span className="text-[10px] bg-[#F6F3EB] text-[#8B887E] border border-[#E9E5DA] px-2 py-0.5 rounded ml-0.5">調查品清單</span>
              </div>
              <div className="p-4">
                <VoiceTextSection
                  value={data.future}
                  onChange={v => updateData({ future: v })}
                  placeholder="為下個 Sprint 或長期目標的建議..."
                  fieldName="展望未來"
                  rows={3}
                  textareaClass={taClass}
                />
              </div>
            </div>

          </div>
        </section>

        <div className="flex justify-end pt-2">
          <Link
            href="/retrospective"
            className="inline-flex items-center gap-2 bg-[#C96442] text-white px-8 py-3 rounded-[9px] font-semibold text-sm hover:bg-[#7A3520] hover:shadow-md hover:-translate-y-[1px] transition-all duration-150"
          >
            前往 Sprint Retrospective (回顧會議) <ArrowRight size={16} strokeWidth={1.75} />
          </Link>
        </div>

      </div>
    </main>
  );
}
