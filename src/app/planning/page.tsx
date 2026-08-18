"use client";
import React, { useState, useRef } from 'react';
import { useAutoSave } from '@/hooks/useAutoSave';
import Link from 'next/link';

import Navigation from '@/components/Navigation';
import ScrumTooltip from '@/components/ScrumTooltip';
import { planningToSprintPlanning, isShallowEqualJSON, type RightPlanning } from '@/lib/planningSync';
import {
  Key, Mic, HelpCircle, Target, Wrench,
  Zap, Plus, Sparkles, Trash2, Sprout,
  ArrowRight, X, Square, Save,
} from 'lucide-react';

const AV_PAL = ['#C96442', '#4F7E5C', '#B8893A', '#467386', '#8B5A2B', '#5A574E'];

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [projectName, setProjectName] = useState('');

  const [orgTeam, setOrgTeam] = React.useState<{ id: string; name: string; role: string }[]>([]);
  const [showDevPicker, setShowDevPicker] = React.useState(false);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('orgTeamMembers');
      if (raw) setOrgTeam(JSON.parse(raw));
    } catch {}
  }, []);

  const { data, updateData, loading } = useAutoSave('planning', {
    poIdea: '',
    timeLimit: '2',
    startDate: '',
    stakeholders: '',
    po: '',
    sm: '',
    devs: '',
    devsList: [{ id: '1', name: '', role: '', email: '' }] as { id: string; name: string; role: string; email: string }[],
    whys: [{ id: '1', text: '' }],
    whats: [{ id: '1', text: '' }],
    hows: [{ id: '1', text: '' }]
  });

  // 舊資料相容：若 devsList 還是空但 devs 字串有內容，從字串拆出列表
  const devsHydratedRef = React.useRef(false);
  React.useEffect(() => {
    if (loading || devsHydratedRef.current) return;
    const list = data.devsList || [];
    const hasContent = list.some(d => (d.name || '').trim() || (d.role || '').trim());
    if (!hasContent && (data.devs || '').trim()) {
      const names = data.devs.split(/[,、，\n]/).map(s => s.trim()).filter(Boolean);
      if (names.length > 0) {
        updateData({
          devsList: names.map((name, i) => ({ id: `${Date.now()}-${i}`, name, role: '', email: '' }))
        });
      }
    }
    devsHydratedRef.current = true;
  }, [loading, data.devs, data.devsList, updateData]);

  const syncDevsString = (list: { id: string; name: string; role: string; email: string }[]) => {
    const joined = list.map(d => d.name.trim()).filter(Boolean).join(',');
    updateData({ devsList: list, devs: joined });
  };

  const updateDev = (index: number, field: 'name' | 'role' | 'email', value: string) => {
    const list = [...(data.devsList || [])];
    list[index] = { ...list[index], [field]: value };
    syncDevsString(list);
  };

  const addDev = () => {
    const list = [...(data.devsList || []), { id: Date.now().toString(), name: '', role: '', email: '' }];
    syncDevsString(list);
  };

  const removeDev = (index: number) => {
    const list = (data.devsList || []).filter((_, i) => i !== index);
    syncDevsString(list.length > 0 ? list : [{ id: Date.now().toString(), name: '', role: '', email: '' }]);
  };

  // 把成員表裡填了 email 的人自動加進 Sprint 協作者（editor），
  // 讓他登入後能讀到這個 Sprint。已存在者不覆蓋其原有角色。
  const syncMembersToCollaborators = React.useCallback(async () => {
    const sprintId = localStorage.getItem('currentSprintId');
    if (!sprintId) return;
    const memberEmails = (data.devsList || [])
      .map(d => (d.email || '').trim().toLowerCase())
      .filter(Boolean);
    if (memberEmails.length === 0) return;

    try {
      const { doc, getDoc, setDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const ref = doc(db, 'sprints', sprintId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;

      const existing: { email: string; role: string }[] = snap.data().collaborators || [];
      const existingSet = new Set(existing.map(c => (c.email || '').toLowerCase()));
      const toAdd = memberEmails.filter(e => !existingSet.has(e));
      if (toAdd.length === 0) return;

      const merged = [...existing, ...toAdd.map(email => ({ email, role: 'editor' }))];
      await setDoc(ref, {
        collaborators: merged,
        collaboratorEmails: merged.map(c => (c.email || '').toLowerCase()),
      }, { merge: true });
    } catch (err) {
      console.warn('[Planning] 同步協作者失敗', err);
    }
  }, [data.devsList]);

  // 元件載入時讀取 API Key，並從 Firestore 取得最新專案名稱
  React.useEffect(() => {
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) setApiKey(savedKey);

    const sprintId = localStorage.getItem('currentSprintId');
    if (!sprintId) {
      const savedSprintName = localStorage.getItem('currentSprintName');
      if (savedSprintName) setProjectName(savedSprintName);
      return;
    }

    (async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const snap = await getDoc(doc(db, 'sprints', sprintId));
        if (snap.exists() && snap.data().name) {
          const name = snap.data().name as string;
          setProjectName(name);
          localStorage.setItem('currentSprintName', name);
          return;
        }
      } catch {}
      const savedSprintName = localStorage.getItem('currentSprintName');
      if (savedSprintName) setProjectName(savedSprintName);
    })();
  }, []);

  // Mirror: planning → sprintPlanning（scrum-project-new 用的 schema）
  // 用 1.5s debounce + 內容相等檢查避免迴圈寫入
  // 優先從 Firestore users/{uid}.currentSprintId 取得 sprintId，解決不同 port localStorage 不同步問題
  React.useEffect(() => {
    if (loading) return;
    const sprintId = typeof window !== 'undefined' ? localStorage.getItem('currentSprintId') : null;
    if (!sprintId) return;
    const timer = setTimeout(async () => {
      try {
        const { doc, getDoc, setDoc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');

        const ref = doc(db, 'sprints', sprintId);
        const snap = await getDoc(ref);
        const existing = snap.exists() ? snap.data().sprintPlanning : undefined;
        const mapped = planningToSprintPlanning(data as RightPlanning, existing);
        if (isShallowEqualJSON(existing, mapped)) return;
        await setDoc(ref, { sprintPlanning: mapped }, { merge: true });
      } catch (err) {
        console.warn('[planningSync] mirror to sprintPlanning failed', err);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [data, loading]);

  const projectNameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setProjectName(value);
    localStorage.setItem('currentSprintName', value);

    if (projectNameTimerRef.current) clearTimeout(projectNameTimerRef.current);
    projectNameTimerRef.current = setTimeout(async () => {
      const sprintId = localStorage.getItem('currentSprintId');
      if (!sprintId) return;
      try {
        const { doc, setDoc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        await setDoc(doc(db, 'sprints', sprintId), { name: value }, { merge: true });
      } catch (err) {
        console.warn('[planning] 更新專案名稱至 Firestore 失敗:', err);
      }
    }, 1000);
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setApiKey(value);
    localStorage.setItem('openai_api_key', value);
  };

  const [aiLoadingKey, setAiLoadingKey] = useState<string | null>(null);

  // 語音輸入狀態
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceSummaries, setVoiceSummaries] = useState<Record<string, string>>({ 精簡: '', 中等: '', 詳述: '' });
  const [voiceSummaryLoading, setVoiceSummaryLoading] = useState<Record<string, boolean>>({ 精簡: false, 中等: false, 詳述: false });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const voiceAudioCtxRef = useRef<AudioContext | null>(null);
  const voiceAnalyserRef = useRef<AnalyserNode | null>(null);
  const voiceAnimFrameRef = useRef<number | null>(null);

  const formatRecordTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const startVoiceWaveform = (stream: MediaStream) => {
    const audioCtx = new AudioContext();
    voiceAudioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    voiceAnalyserRef.current = analyser;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      voiceAnimFrameRef.current = requestAnimationFrame(draw);
      const canvas = voiceCanvasRef.current;
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

  const stopVoiceWaveform = () => {
    if (voiceAnimFrameRef.current) { cancelAnimationFrame(voiceAnimFrameRef.current); voiceAnimFrameRef.current = null; }
    if (voiceAudioCtxRef.current) { voiceAudioCtxRef.current.close(); voiceAudioCtxRef.current = null; }
    voiceAnalyserRef.current = null;
    const canvas = voiceCanvasRef.current;
    if (canvas) { const ctx = canvas.getContext('2d'); if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); }
  };

  const resetVoice = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    stopVoiceWaveform();
    if (mediaRecorderRef.current && isRecording) {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    setIsRecording(false);
    setRecordingTime(0);
    setRecordedBlob(null);
    setAudioUrl('');
    setVoiceTranscript('');
    setVoiceSummaries({ 精簡: '', 中等: '', 詳述: '' });
    setVoiceSummaryLoading({ 精簡: false, 中等: false, 詳述: false });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
        stopVoiceWaveform();
      };
      mr.start();
      startVoiceWaveform(stream);
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch {
      alert('無法存取麥克風，請確認瀏覽器已授予麥克風權限。');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    }
  };

  const handleTranscribe = async () => {
    if (!recordedBlob) return;
    if (!apiKey) { alert('⚠️ 請先輸入 API Key！'); return; }
    setIsTranscribing(true);
    setVoiceTranscript('');
    setVoiceSummaries({ 精簡: '', 中等: '', 詳述: '' });
    try {
      const fd = new FormData();
      fd.append('audio', recordedBlob, 'audio.webm');
      fd.append('apiKey', apiKey);
      const res = await fetch('/api/ai-transcribe', { method: 'POST', body: fd });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || '轉錄失敗'); }
      const result = await res.json();
      const text = result.text || '';
      setVoiceTranscript(text);
      if (text) generateVoiceSummaries(text);
    } catch (err: unknown) {
      alert('轉錄失敗：' + ((err as Error).message || '未知錯誤'));
    } finally {
      setIsTranscribing(false);
    }
  };

  const generateVoiceSummaries = async (text: string) => {
    const levelMap: [string, string][] = [['精簡', '精簡'], ['中等', '適中'], ['詳述', '詳細']];
    setVoiceSummaryLoading({ 精簡: true, 中等: true, 詳述: true });
    await Promise.all(levelMap.map(async ([label, apiLevel]) => {
      try {
        const res = await fetch('/api/ai-voice-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, text, level: apiLevel, fieldName: '初步想法' })
        });
        const d = await res.json();
        setVoiceSummaries(prev => ({ ...prev, [label]: d.result || '' }));
      } catch {
        setVoiceSummaries(prev => ({ ...prev, [label]: '生成失敗，請重試' }));
      } finally {
        setVoiceSummaryLoading(prev => ({ ...prev, [label]: false }));
      }
    }));
  };

  const handleAiRewrite = async (setter: React.Dispatch<React.SetStateAction<{ id: string; text: string }[]>>, items: { id: string; text: string }[], index: number, fieldType: 'WHY' | 'WHAT' | 'HOW') => {
    if (!apiKey) {
      alert('⚠️ 請先於頁面頂部輸入您的 API Key，才能啟動魔法潤飾功能！');
      return;
    }

    const poIdea = data.poIdea.trim() || '';
    const newItems = [...items];
    const currentText = newItems[index].text.trim();

    const members = {
      po: data.po || '',
      sm: data.sm || '',
      devs: data.devs || '',
      stakeholders: data.stakeholders || ''
    };

    const loadingKey = `${fieldType}-${items[index].id}`;
    setAiLoadingKey(loadingKey);
    try {
      const response = await fetch('/api/ai-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, fieldType, currentText, poIdea, members })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || '後端請求失敗');
      }

      const resData = await response.json();
      newItems[index].text = resData.result || currentText;
      setter(newItems);
    } catch (err: unknown) {
      const e = err as Error;
      console.error('AI Rewrite Error:', e);
      alert('潤飾失敗：' + (e.message || '未知錯誤'));
    } finally {
      setAiLoadingKey(null);
    }
  };

  const renderDynamicList = (items: { id: string; text: string }[], setter: React.Dispatch<React.SetStateAction<{ id: string; text: string }[]>>, placeholder: string, fieldType: 'WHY' | 'WHAT' | 'HOW') => {
    return (
      <div className="flex-1 flex flex-col gap-3">
        {items.map((item, index) => {
          const itemLoadingKey = `${fieldType}-${item.id}`;
          const isThisLoading = aiLoadingKey === itemLoadingKey;
          const isAnyLoading = aiLoadingKey !== null;
          return (
          <div key={item.id} className="flex gap-2 items-start group">
            <div className={`flex-1 relative transition-opacity ${isThisLoading ? 'opacity-70' : ''}`}>
              <textarea
                className="w-full px-3 py-2.5 bg-white border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] font-sans text-sm text-[#1F1D17] transition-all disabled:cursor-wait resize-none"
                placeholder={placeholder}
                rows={2}
                value={item.text}
                disabled={isThisLoading}
                onChange={(e) => {
                  const newItems = [...items];
                  newItems[index].text = e.target.value;
                  setter(newItems);
                }}
              />
              {isThisLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px] rounded-lg pointer-events-none">
                  <div className="flex items-center gap-2 bg-white border border-[#E9E5DA] text-[#C96442] px-3 py-1.5 rounded-full shadow-sm text-xs">
                    <span className="inline-block w-3 h-3 border-2 border-[#C96442] border-t-transparent rounded-full animate-spin"></span>
                    <span>潤飾中...</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleAiRewrite(setter, items, index, fieldType)}
                disabled={isAnyLoading}
                aria-busy={isThisLoading}
                className={`px-2.5 py-1.5 rounded-lg text-xs border transition-all flex items-center justify-center gap-1 min-w-[80px]
                  ${isThisLoading
                    ? 'border-[#C96442] text-[#C96442] bg-[#F5E4DA] cursor-wait'
                    : 'border-[#C96442] text-[#C96442] hover:bg-[#F5E4DA]'}
                  ${isAnyLoading && !isThisLoading ? 'opacity-40 cursor-not-allowed' : ''}
                `}
                title={isThisLoading ? '正在請 AI 潤飾，請稍候' : '使用魔法讓描述更精準'}
              >
                {isThisLoading ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-[#C96442] border-t-transparent rounded-full animate-spin"></span>
                    <span>潤飾中</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={12} strokeWidth={1.75} />
                    魔法潤飾
                  </>
                )}
              </button>
              {items.length > 1 && (
                <button
                  onClick={() => setter(items.filter((_: { id: string; text: string }, i: number) => i !== index))}
                  disabled={isThisLoading}
                  className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#B8543C] text-[#B8543C] text-xs hover:bg-[#F0DDD3] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 size={12} strokeWidth={1.75} />
                  掃除
                </button>
              )}
            </div>
          </div>
          );
        })}
        <div>
          <button
            onClick={() => setter([...items, { id: Date.now().toString(), text: '' }])}
            className="flex items-center gap-1.5 text-sm text-[#8B887E] hover:text-[#C96442] px-4 py-2 border border-dashed border-[#D8D3C5] hover:border-[#C96442] rounded-lg transition-all duration-150"
          >
            <Sprout size={14} strokeWidth={1.75} />
            播種新欄位
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#FAF9F5] p-8 font-sans text-[#1F1D17]">
      <div className="w-full space-y-6">

        <Navigation />

        {/* API Key 設定區塊 */}
        <div className="bg-white border border-[#E9E5DA] p-4 rounded-[10px] flex flex-col md:flex-row items-center gap-4">
          <div className="text-[#5A574E] font-medium flex items-center gap-2 whitespace-nowrap">
            <Key size={15} strokeWidth={1.75} className="text-[#8B887E]" />
            AI 魔法鑰匙 (API Key)：
          </div>
          <input
            type="password"
            value={apiKey}
            onChange={handleApiKeyChange}
            className="flex-1 w-full px-4 py-2 bg-[#FAF9F5] border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] text-[#1F1D17] font-sans text-sm"
            placeholder="請輸入您的 OpenAI API Key (sk-...)"
          />
          <div className="text-xs text-[#8B887E] whitespace-nowrap">
            * 您的金鑰僅會儲存於本地瀏覽器中
          </div>
        </div>

        {/* Header 專案基本資訊 */}
        <header className="bg-white border border-[#E9E5DA] p-6 rounded-xl">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <h1 className="text-xl font-semibold text-[#1F1D17] whitespace-nowrap">專案名稱：</h1>
            <input
              type="text"
              value={projectName}
              onChange={handleProjectNameChange}
              className="flex-1 px-4 py-3 text-base bg-[#FAF9F5] border border-[#D8D3C5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] text-[#1F1D17]"
              placeholder="請輸入專案名稱..."
            />
          </div>
        </header>

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
            <div className="bg-white px-6 py-4 rounded-xl border border-[#E9E5DA] text-[#5A574E] shadow-xl text-sm flex items-center gap-3">
              <Save size={16} strokeWidth={1.75} className="text-[#8B887E]" />
              <span>載入資料中...</span>
            </div>
          </div>
        )}

        {/* Sprint Planning 模組 */}
        <section className="bg-white border border-[#E9E5DA] rounded-xl overflow-hidden">
          <div className="bg-[#F6F3EB] border-b border-[#E9E5DA] px-5 py-4 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#C96442] flex items-center justify-center flex-shrink-0">
              <Target size={14} strokeWidth={2} className="text-white" />
            </div>
            <h2 className="text-[15px] font-semibold text-[#1F1D17]">
              <ScrumTooltip keyword="Sprint Planning" text="Sprint Planning (Sprint 計畫)" />
            </h2>
          </div>

          <div className="p-6 space-y-6">
            {/* 基礎資訊 */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* 左側 3 個欄位 */}
              <div className="flex-1 flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#5A574E]">目的</label>
                  <div className="px-3 py-2.5 bg-[#F6F3EB] border border-[#E9E5DA] rounded-lg text-[#1F1D17] text-sm">
                    建立共識並敲定行動計畫
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#5A574E]">時間限制 (TIME)</label>
                  <select
                    className="px-3 py-2.5 bg-white border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] text-sm text-[#1F1D17]"
                    value={data.timeLimit}
                    onChange={e => {
                      const val = e.target.value;
                      updateData({ timeLimit: val });
                      const days = val === '30d' ? 30 : Number(val) * 7;
                      if (days > 0) localStorage.setItem('sprintDays', String(days));
                    }}
                  >
                    <option value="1">1 週 (≤ 2 小時)</option>
                    <option value="2">2 週 (≤ 4 小時)</option>
                    <option value="3">3 週 (≤ 6 小時)</option>
                    <option value="4">4 週 (≤ 8 小時)</option>
                    <option value="30d">30 天 (≤ 8 小時)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#5A574E]">開始日</label>
                  <input
                    type="date"
                    value={data.startDate}
                    onChange={e => updateData({ startDate: e.target.value })}
                    className="px-3 py-2.5 bg-white border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] text-sm text-[#1F1D17]"
                  />
                </div>
              </div>

              {/* 右側：與會人 */}
              <div className="flex-1 flex flex-col gap-4">
                <label className="text-sm font-medium text-[#5A574E]">與會人</label>

                {/* datalist for member suggestions */}
                <datalist id="org-members-list">
                  {orgTeam.map(m => <option key={m.id} value={m.name} />)}
                </datalist>

                {/* PO / SM */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="text-sm font-medium text-[#5A574E]">
                      <ScrumTooltip keyword="PO" text="Product Owner" /> <span className="text-[#B8543C]">*</span>
                    </div>
                    <input
                      list="org-members-list"
                      type="text"
                      value={data.po || ''}
                      onChange={e => updateData({ po: e.target.value })}
                      className="px-3 py-2.5 bg-white border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] text-sm text-[#1F1D17]"
                      placeholder={orgTeam.length > 0 ? '輸入或從成員庫選取...' : 'PO 姓名'}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="text-sm font-medium text-[#5A574E]">
                      <ScrumTooltip keyword="SM" text="Scrum Master" /> <span className="text-[#B8543C]">*</span>
                    </div>
                    <input
                      list="org-members-list"
                      type="text"
                      value={data.sm || ''}
                      onChange={e => updateData({ sm: e.target.value })}
                      className="px-3 py-2.5 bg-white border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] text-sm text-[#1F1D17]"
                      placeholder={orgTeam.length > 0 ? '輸入或從成員庫選取...' : 'SM 姓名'}
                    />
                  </div>
                </div>

                {/* 開發團隊 */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-[#5A574E]"><ScrumTooltip keyword="DEVS" text="開發團隊" /></div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-[#8B887E]">{(data.devsList || []).filter(d => (d.name || '').trim()).length} 位</div>
                      {orgTeam.length > 0 && (
                        <button
                          onClick={() => setShowDevPicker(prev => !prev)}
                          className="flex items-center gap-1 text-xs text-[#5A574E] hover:text-[#C96442] bg-white border border-[#E9E5DA] px-2.5 py-1 rounded-lg transition-all hover:-translate-y-[1px] hover:shadow-sm duration-150"
                        >
                          <Zap size={11} strokeWidth={1.75} />
                          從成員庫選
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 成員庫快選面板 */}
                  {showDevPicker && orgTeam.length > 0 && (
                    <div className="bg-[#F6F3EB] border border-[#E9E5DA] rounded-lg p-3 flex flex-wrap gap-2">
                      {orgTeam.map((m, mi) => {
                        const alreadyAdded = (data.devsList || []).some(d => d.name === m.name);
                        return (
                          <button
                            key={m.id}
                            onClick={() => {
                              if (alreadyAdded) return;
                              const list = [...(data.devsList || []).filter(d => (d.name || '').trim()), { id: Date.now().toString(), name: m.name, role: m.role, email: '' }];
                              syncDevsString(list);
                            }}
                            disabled={alreadyAdded}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all
                              ${alreadyAdded
                                ? 'bg-[#F1EEE6] border-[#D8D3C5] text-[#8B887E] cursor-default'
                                : 'bg-white border-[#E9E5DA] text-[#1F1D17] hover:border-[#C96442] hover:text-[#C96442]'
                              }`}
                            title={alreadyAdded ? '已加入' : `加入 ${m.name}`}
                          >
                            <span
                              className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: AV_PAL[mi % AV_PAL.length] }}
                            >
                              {(m.name || '?').slice(0, 1)}
                            </span>
                            {m.name}{m.role ? <span className="text-[#8B887E]">・{m.role}</span> : null}
                            {alreadyAdded && <span className="text-[#4F7E5C] text-xs">✓</span>}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setShowDevPicker(false)}
                        className="text-xs text-[#8B887E] hover:text-[#1F1D17] px-2 py-1 ml-auto"
                      >
                        收起
                      </button>
                    </div>
                  )}

                  <div className="bg-white border border-[#E9E5DA] rounded-lg divide-y divide-[#E9E5DA]">
                    {(data.devsList || []).map((dev, i) => (
                      <div key={dev.id} className="flex items-start gap-2 px-3 py-2">
                        <span
                          className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: AV_PAL[i % AV_PAL.length] }}
                        >
                          {(dev.name || '?').slice(0, 1) || '?'}
                        </span>
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={dev.name}
                              onChange={e => updateDev(i, 'name', e.target.value)}
                              className="flex-1 min-w-0 bg-transparent border-b border-transparent focus:border-[#C96442] outline-none text-sm text-[#1F1D17] placeholder-[#B5B2A6]"
                              placeholder="姓名"
                            />
                            <input
                              type="text"
                              value={dev.role}
                              onChange={e => updateDev(i, 'role', e.target.value)}
                              className="w-32 bg-transparent border-b border-transparent focus:border-[#C96442] outline-none text-xs text-[#8B887E] placeholder-[#B5B2A6]"
                              placeholder="角色（例：Tech Lead）"
                            />
                          </div>
                          <input
                            type="email"
                            value={dev.email || ''}
                            onChange={e => updateDev(i, 'email', e.target.value)}
                            onBlur={() => syncMembersToCollaborators()}
                            className="bg-transparent border-b border-transparent focus:border-[#C96442] outline-none text-xs text-[#8B887E] placeholder-[#B5B2A6]"
                            placeholder="Google 帳號 Email（填了才能登入認領自己的工作）"
                          />
                        </div>
                        <button
                          onClick={() => removeDev(i)}
                          className="text-[#B5B2A6] hover:text-[#B8543C] px-1.5 py-1 rounded transition-colors shrink-0 mt-0.5"
                          title="移除這位成員"
                        >
                          <X size={14} strokeWidth={1.75} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addDev}
                    className="self-start flex items-center gap-1.5 text-sm text-[#5A574E] hover:text-[#C96442] px-3 py-1.5 bg-white border border-[#E9E5DA] rounded-lg hover:border-[#C96442] hover:-translate-y-[1px] hover:shadow-sm transition-all duration-150"
                  >
                    <Plus size={14} strokeWidth={1.75} />
                    新增成員
                  </button>
                  <div className="text-xs text-[#8B887E]">
                    填入成員的 Google 帳號 Email 後，該成員會自動成為本專案協作者，登入後即可在「我的工作」看到並編輯指派給自己的項目。
                  </div>
                </div>

                {/* 利害關係人 / 專家 */}
                <div className="flex flex-col gap-1.5">
                  <div className="text-sm font-medium text-[#5A574E]">利害關係人 / 專家（選填）</div>
                  <textarea
                    value={data.stakeholders}
                    onChange={e => updateData({ stakeholders: e.target.value })}
                    rows={3}
                    className="px-3 py-2.5 bg-white border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] text-sm text-[#1F1D17] resize-none"
                    placeholder="一行一位，例如：&#10;陳副總（主要贊助人）&#10;Globex IT 部門（客戶代表）"
                  />
                  <div className="text-xs text-[#8B887E]">一行一位，可加註角色，例如「王經理（客戶代表）」</div>
                </div>
              </div>
            </div>

            {/* 初步想法 */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[#5A574E]">初步想法 (PO提出)</label>
                <button
                  onClick={() => { resetVoice(); setShowVoiceModal(true); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-[#C96442] text-[#C96442] rounded-lg hover:bg-[#F5E4DA] hover:-translate-y-[1px] transition-all duration-150"
                >
                  <Mic size={13} strokeWidth={1.75} />
                  語音輸入
                </button>
              </div>
              <textarea
                value={data.poIdea}
                onChange={e => updateData({ poIdea: e.target.value })}
                rows={2}
                className="w-full px-3 py-2.5 bg-white border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA] text-sm text-[#1F1D17] resize-none"
                placeholder="請輸入初步想法..."
              />
            </div>

            {/* 核心規劃矩陣 */}
            <div className="mt-6 pt-6 border-t border-[#E9E5DA]">
              <h3 className="font-semibold text-lg mb-5 text-[#1F1D17]">
                核心規劃矩陣
              </h3>

              <div className="space-y-5">

                {/* WHY */}
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="lg:w-60 bg-white border border-[#E9E5DA] border-l-[3px] border-l-[#B8893A] p-4 flex flex-col items-center justify-center rounded-xl text-center shrink-0">
                    <HelpCircle size={20} strokeWidth={1.75} className="text-[#B8893A] mb-2" />
                    <div className="font-semibold text-lg mb-1 text-[#1F1D17]"><ScrumTooltip keyword="WHY" text="WHY" /></div>
                    <div className="text-xs text-[#8B887E]">[為什麼這個 Sprint 有價值？]</div>
                    <div className="text-xs text-[#5A574E] mt-1">[驗證技術可行性]</div>
                  </div>
                  {renderDynamicList(data.whys, (newItems) => updateData({ whys: typeof newItems === 'function' ? newItems(data.whys) : newItems }), "請輸入價值描述...", 'WHY')}
                </div>

                {/* WHAT */}
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="lg:w-60 bg-white border border-[#E9E5DA] border-l-[3px] border-l-[#C96442] p-4 flex flex-col items-center justify-center rounded-xl text-center shrink-0">
                    <Target size={20} strokeWidth={1.75} className="text-[#C96442] mb-2" />
                    <div className="font-semibold text-lg mb-1 text-[#1F1D17]"><ScrumTooltip keyword="WHAT" text="WHAT" /></div>
                    <div className="text-xs text-[#8B887E]">[這個 Sprint 能完成什麼？]</div>
                    <div className="text-xs text-[#5A574E] mt-1">[具體化的功能模組]</div>
                    <div className="text-xs text-[#B8543C] mt-1">(Sprint Backlog基礎)</div>
                  </div>
                  {renderDynamicList(data.whats, (newItems) => updateData({ whats: typeof newItems === 'function' ? newItems(data.whats) : newItems }), "請輸入具體功能模組...", 'WHAT')}
                </div>

                {/* HOW */}
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="lg:w-60 bg-white border border-[#E9E5DA] border-l-[3px] border-l-[#8B887E] p-4 flex flex-col items-center justify-center rounded-xl text-center shrink-0">
                    <Wrench size={20} strokeWidth={1.75} className="text-[#8B887E] mb-2" />
                    <div className="font-semibold text-lg mb-1 text-[#1F1D17]"><ScrumTooltip keyword="HOW" text="HOW" /></div>
                    <div className="text-xs text-[#8B887E]">[工作將如何完成？]</div>
                    <div className="text-xs text-[#5A574E] mt-1">[思考如何串接這些工具]</div>
                  </div>
                  {renderDynamicList(data.hows, (newItems) => updateData({ hows: typeof newItems === 'function' ? newItems(data.hows) : newItems }), "請輸入工作方式與工具...", 'HOW')}
                </div>

              </div>
            </div>

            <div className="flex justify-end pt-6">
              <Link
                href="/backlog"
                className="inline-flex items-center gap-2 bg-[#C96442] text-white px-8 py-3 rounded-[9px] font-semibold text-sm hover:bg-[#7A3520] hover:shadow-md hover:-translate-y-[1px] transition-all duration-150"
              >
                儲存計畫並前往 Backlog
                <ArrowRight size={16} strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        </section>

      </div>

      {/* 語音輸入 Modal */}
      {showVoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { resetVoice(); setShowVoiceModal(false); }}>
          <div className="bg-white border border-[#E9E5DA] rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-white border-b border-[#E9E5DA] px-6 py-4 rounded-t-xl flex items-center justify-between flex-shrink-0">
              <h2 className="font-semibold text-[#1F1D17] flex items-center gap-2">
                <Mic size={16} strokeWidth={1.75} className="text-[#8B887E]" />
                語音輸入 — 初步想法
              </h2>
              <button onClick={() => { resetVoice(); setShowVoiceModal(false); }} className="text-[#8B887E] hover:text-[#1F1D17] transition-colors">
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* 錄音控制 */}
              <div className="flex flex-col items-center gap-3 py-3">
                {!recordedBlob ? (
                  <>
                    {isRecording ? (
                      <>
                        <canvas ref={voiceCanvasRef} width={500} height={48} className="w-full rounded-lg border border-[#E9E5DA] bg-[#1F1D17]" />
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-sm font-mono text-red-500 font-semibold">
                            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            {formatRecordTime(recordingTime)}
                          </div>
                          <button
                            onClick={stopRecording}
                            className="flex items-center gap-1.5 border border-[#B8543C] text-[#B8543C] font-semibold px-5 py-2 rounded-lg hover:bg-[#F0DDD3] transition-all"
                          >
                            <Square size={14} strokeWidth={1.75} />
                            停止錄音
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={startRecording}
                        className="flex items-center gap-2 bg-[#C96442] hover:bg-[#7A3520] text-white font-semibold px-6 py-3 rounded-lg shadow-sm transition-all active:scale-95 text-sm"
                      >
                        <Mic size={16} strokeWidth={1.75} />
                        開始錄音
                      </button>
                    )}
                    <div className="text-xs text-[#8B887E]">請確認瀏覽器已允許麥克風存取</div>
                  </>
                ) : (
                  <div className="w-full space-y-3">
                    <div className="flex items-center gap-3">
                      <audio src={audioUrl} controls className="flex-1 h-10" />
                      <button
                        onClick={() => { setRecordedBlob(null); setAudioUrl(''); setVoiceTranscript(''); setVoiceSummaries({ 精簡: '', 中等: '', 詳述: '' }); }}
                        className="text-xs text-[#8B887E] hover:text-[#1F1D17] border border-[#E9E5DA] px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors"
                      >
                        重新錄
                      </button>
                    </div>
                    {!voiceTranscript && (
                      <button
                        onClick={handleTranscribe}
                        disabled={isTranscribing}
                        className="w-full bg-[#C96442] hover:bg-[#7A3520] disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        {isTranscribing
                          ? <><span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />AI 轉錄中...</>
                          : <><Sparkles size={15} strokeWidth={1.75} />AI 轉錄 & 解析</>}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 原始轉錄 */}
              {voiceTranscript && (
                <div className="bg-[#F6F3EB] border border-[#E9E5DA] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs font-medium text-[#8B887E]">原始轉錄文字</div>
                    <button
                      onClick={() => { updateData({ poIdea: voiceTranscript }); setShowVoiceModal(false); }}
                      className="text-xs text-[#C96442] border border-[#C96442] px-2 py-0.5 rounded-lg hover:bg-[#F5E4DA] transition-colors"
                    >
                      使用原文
                    </button>
                  </div>
                  <div className="text-sm text-[#1F1D17] leading-relaxed">{voiceTranscript}</div>
                </div>
              )}

              {/* AI 摘要三等級 */}
              {voiceTranscript && (
                <div className="space-y-2.5">
                  <div className="text-xs font-medium text-[#8B887E] uppercase tracking-wide">AI 摘要等級</div>
                  {(['精簡', '中等', '詳述'] as const).map(level => (
                    <div key={level} className="bg-white border border-[#E9E5DA] rounded-[10px] p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-xs font-medium text-[#5A574E]">
                          {level === '精簡' ? '🌿 精簡' : level === '中等' ? '🌱 中等' : '📖 詳述'}
                        </div>
                        {voiceSummaries[level] && !voiceSummaryLoading[level] && (
                          <button
                            onClick={() => { updateData({ poIdea: voiceSummaries[level] }); setShowVoiceModal(false); }}
                            className="text-xs bg-[#C96442] text-white px-2.5 py-0.5 rounded-lg hover:bg-[#7A3520] transition-all"
                          >
                            使用此版本
                          </button>
                        )}
                      </div>
                      {voiceSummaryLoading[level] ? (
                        <div className="flex items-center gap-2 text-xs text-[#8B887E]">
                          <span className="inline-block w-3 h-3 border-2 border-[#C96442] border-t-transparent rounded-full animate-spin" />
                          生成中...
                        </div>
                      ) : voiceSummaries[level] ? (
                        <div className="text-sm text-[#1F1D17] leading-relaxed whitespace-pre-wrap">{voiceSummaries[level]}</div>
                      ) : (
                        <div className="text-xs text-[#B5B2A6]">—</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
