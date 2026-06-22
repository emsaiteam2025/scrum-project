"use client";
import React, { useState, useEffect, useMemo } from 'react';
import Navigation from '@/components/Navigation';

interface PersonRecord {
  name: string;
  q1: string;
  q2: string;
  q3: string;
}

interface DayEntry {
  dayIndex: number;
  label: string;
  date: string;
  dow: string;
  isCompleted: boolean;
  records: PersonRecord[];
}

const WEEKDAYS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

function getPersonNote(notes: Record<number, unknown>, dayIdx: number, person: string): string {
  const v = notes[dayIdx];
  if (!v || typeof v === 'string') return '';
  return (v as Record<string, string>)[person] || '';
}

function timeLimitToDays(tl: unknown): number {
  if (tl === '30d') return 30;
  const n = Number(tl);
  if (!Number.isFinite(n) || n <= 0) return 30;
  return n * 7;
}

export default function WorkJournal() {
  const [sprintName, setSprintName] = useState('');
  const [sprintGoal, setSprintGoal] = useState('');
  const [devNames, setDevNames] = useState<string[]>([]);
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'date' | 'person'>('date');
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [onlyRecorded, setOnlyRecorded] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
  const [expandedPersons, setExpandedPersons] = useState<Set<string>>(new Set());

  useEffect(() => {
    const sprintId = localStorage.getItem('currentSprintId');
    if (!sprintId) { setLoading(false); return; }

    (async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const snap = await getDoc(doc(db, 'sprints', sprintId));
        if (!snap.exists()) { setLoading(false); return; }
        const data = snap.data();

        const planning = data.planning || {};
        setSprintName(data.name || planning.sprintName || '未命名 Sprint');
        setSprintGoal(planning.goal || '');
        const sDate = planning.startDate || '';

        const rawDevs: string[] =
          Array.isArray(planning.devsList) && planning.devsList.length > 0
            ? planning.devsList.map((d: { name: string }) => d.name).filter(Boolean)
            : typeof planning.devs === 'string' && planning.devs
              ? planning.devs.split(',').map((n: string) => n.trim()).filter(Boolean)
              : [];
        setDevNames(rawDevs);
        setSelectedPeople(rawDevs);
        setExpandedPersons(new Set(rawDevs));

        const daily = data.daily || {};
        const completedDays: boolean[] = daily.completedDays || [];
        const q1Map: Record<number, unknown> = daily.dailyNotesQ1 || {};
        const q2Map: Record<number, unknown> = daily.dailyNotesQ2 || {};
        const q3Map: Record<number, unknown> = daily.dailyNotesQ3 || {};

        const sprintDays = timeLimitToDays(planning.timeLimit || planning.duration);
        const base = sDate ? new Date(sDate) : null;

        const dayEntries: DayEntry[] = [];
        for (let i = 0; i < sprintDays; i++) {
          const records: PersonRecord[] = rawDevs.map(name => ({
            name,
            q1: getPersonNote(q1Map, i, name),
            q2: getPersonNote(q2Map, i, name),
            q3: getPersonNote(q3Map, i, name),
          }));

          let dateStr = '';
          let dowStr = '';
          if (base) {
            const d = new Date(base);
            d.setDate(d.getDate() + i);
            dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
            dowStr = WEEKDAYS[d.getDay()];
          }

          dayEntries.push({
            dayIndex: i,
            label: `Day ${i + 1}`,
            date: dateStr,
            dow: dowStr,
            isCompleted: !!completedDays[i],
            records,
          });
        }

        setEntries(dayEntries);

        const toExpand = new Set<number>();
        dayEntries.forEach(e => {
          if (e.isCompleted || e.records.some(r => r.q1 || r.q2 || r.q3)) {
            toExpand.add(e.dayIndex);
          }
        });
        setExpandedDays(toExpand);
      } catch (err) {
        console.error('[WorkJournal]', err);
      }
      setLoading(false);
    })();
  }, []);

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (onlyRecorded) {
      result = result.filter(e =>
        e.isCompleted || e.records.some(r =>
          selectedPeople.includes(r.name) && (r.q1 || r.q2 || r.q3)
        )
      );
    }
    return result.map(e => ({
      ...e,
      records: e.records.filter(r => selectedPeople.includes(r.name)),
    }));
  }, [entries, selectedPeople, onlyRecorded]);

  const byPerson = useMemo(() => {
    return devNames
      .filter(name => selectedPeople.includes(name))
      .map(name => ({
        name,
        days: filteredEntries
          .map(e => ({
            ...e,
            record: e.records.find(r => r.name === name) || { name, q1: '', q2: '', q3: '' },
          }))
          .filter(e => e.isCompleted || e.record.q1 || e.record.q2 || e.record.q3),
      }));
  }, [devNames, selectedPeople, filteredEntries]);

  const impediments = useMemo(() => {
    return filteredEntries.flatMap(e =>
      e.records
        .filter(r => r.q3 && r.q3.trim() && r.q3.trim() !== '無' && r.q3.trim().toUpperCase() !== 'N/A')
        .map(r => ({ day: e.label, date: e.date, dow: e.dow, person: r.name, content: r.q3 }))
    );
  }, [filteredEntries]);

  const recordedCount = entries.filter(e => e.records.some(r => r.q1 || r.q2 || r.q3)).length;
  const completedCount = entries.filter(e => e.isCompleted).length;

  const copyReport = () => {
    const now = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const lines: string[] = [
      `工作日誌 - ${sprintName}`,
      `產出時間：${now}`,
      sprintGoal ? `Sprint Goal：${sprintGoal}` : '',
      '='.repeat(44),
      '',
    ].filter(l => l !== null) as string[];

    if (viewMode === 'date') {
      filteredEntries.forEach(entry => {
        lines.push(`▌ ${entry.label}${entry.date ? ` (${entry.date} ${entry.dow})` : ''} ${entry.isCompleted ? '✅' : '○'}`);
        entry.records.forEach(r => {
          lines.push(`  【${r.name}】`);
          if (r.q1) lines.push(`    昨天完成：${r.q1}`);
          if (r.q2) lines.push(`    今天計劃：${r.q2}`);
          if (r.q3) lines.push(`    阻礙事項：${r.q3}`);
          if (!r.q1 && !r.q2 && !r.q3) lines.push(`    （無紀錄）`);
        });
        lines.push('');
      });
    } else {
      byPerson.forEach(p => {
        lines.push(`▌ 【${p.name}】`);
        p.days.forEach(e => {
          lines.push(`  ${e.label}${e.date ? ` (${e.date} ${e.dow})` : ''}`);
          if (e.record.q1) lines.push(`    昨天完成：${e.record.q1}`);
          if (e.record.q2) lines.push(`    今天計劃：${e.record.q2}`);
          if (e.record.q3) lines.push(`    阻礙事項：${e.record.q3}`);
        });
        lines.push('');
      });
    }

    if (impediments.length > 0) {
      lines.push('='.repeat(44));
      lines.push('⚠️  阻礙事項彙整');
      lines.push('-'.repeat(44));
      impediments.forEach(imp => {
        lines.push(`  ${imp.day}${imp.date ? ` (${imp.date} ${imp.dow})` : ''} ${imp.person}：${imp.content}`);
      });
    }

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    }).catch(() => {});
  };

  const toggleDay = (idx: number) =>
    setExpandedDays(prev => {
      const s = new Set(prev);
      if (s.has(idx)) { s.delete(idx); } else { s.add(idx); }
      return s;
    });

  const togglePerson = (name: string) =>
    setExpandedPersons(prev => {
      const s = new Set(prev);
      if (s.has(name)) { s.delete(name); } else { s.add(name); }
      return s;
    });

  const togglePersonFilter = (name: string) =>
    setSelectedPeople(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);

  return (
    <main className="min-h-screen bg-[#f4f1ea] p-8 font-serif text-[#3e362e] bg-[url('https://www.transparenttextures.com/patterns/rice-paper-2.png')]">
      <div className="w-full space-y-6">
        <Navigation />

        {loading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
            <div className="bg-white px-6 py-4 rounded-xl font-bold text-[#5b755e] shadow-xl text-lg flex items-center gap-3">
              <span>💾</span><span>載入資料中...</span>
            </div>
          </div>
        )}

        {/* 頁首 */}
        <section className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-[#5b755e] border-b-4 border-[#3e5240] p-5 flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📊</span>
              <div>
                <div className="text-xl font-bold text-white">工作日誌</div>
                {sprintName && <div className="text-sm text-white/80 mt-0.5">{sprintName}</div>}
                {sprintGoal && <div className="text-xs text-white/60 mt-1 max-w-lg">🎯 {sprintGoal}</div>}
              </div>
            </div>
            <button
              onClick={copyReport}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md flex-shrink-0 ${
                copySuccess ? 'bg-[#8fb996] text-white' : 'bg-white text-[#5b755e] hover:bg-[#f0f4ec]'
              }`}
            >
              {copySuccess ? '✅ 已複製！' : '📋 複製文字報告'}
            </button>
          </div>

          {/* 統計卡 */}
          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#e8eedd] border-2 border-[#8fb996] rounded-2xl p-4 text-center">
              <div className="text-3xl font-black text-[#5b755e]">{completedCount}</div>
              <div className="text-xs font-bold text-[#7a9e7e] mt-1">已完成天數</div>
            </div>
            <div className="bg-[#f2e3c6] border-2 border-[#d4a373] rounded-2xl p-4 text-center">
              <div className="text-3xl font-black text-[#8b5a2b]">{recordedCount}</div>
              <div className="text-xs font-bold text-[#a07040] mt-1">有紀錄天數</div>
            </div>
            <div className="bg-[#fceded] border-2 border-[#e6b1b1] rounded-2xl p-4 text-center">
              <div className="text-3xl font-black text-[#c96262]">{impediments.length}</div>
              <div className="text-xs font-bold text-[#d07070] mt-1">阻礙事項</div>
            </div>
            <div className="bg-[#e8f0fa] border-2 border-[#a0b8d8] rounded-2xl p-4 text-center">
              <div className="text-3xl font-black text-[#4a6898]">{devNames.length}</div>
              <div className="text-xs font-bold text-[#6080a8] mt-1">團隊成員</div>
            </div>
          </div>
        </section>

        {/* 控制列 */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 視圖切換 */}
          <div className="flex rounded-xl overflow-hidden border-2 border-[#8fb996] shadow-sm">
            <button
              onClick={() => setViewMode('date')}
              className={`px-4 py-2 font-bold text-sm transition-colors ${viewMode === 'date' ? 'bg-[#5b755e] text-white' : 'bg-[#fffdf9] text-[#5b755e] hover:bg-[#e8eedd]'}`}
            >📅 依日期</button>
            <button
              onClick={() => setViewMode('person')}
              className={`px-4 py-2 font-bold text-sm transition-colors border-l-2 border-[#8fb996] ${viewMode === 'person' ? 'bg-[#5b755e] text-white' : 'bg-[#fffdf9] text-[#5b755e] hover:bg-[#e8eedd]'}`}
            >👤 依人員</button>
          </div>

          {/* 僅顯示有紀錄 */}
          <label className="flex items-center gap-2 cursor-pointer bg-[#fffdf9] border-2 border-[#d3cbbd] px-3 py-2 rounded-xl text-sm font-bold text-[#6b5e50] hover:bg-[#f4f1ea] transition-colors select-none">
            <input type="checkbox" checked={onlyRecorded} onChange={e => setOnlyRecorded(e.target.checked)} className="w-4 h-4 accent-[#5b755e]" />
            僅顯示有紀錄天
          </label>

          {/* 成員篩選 */}
          {devNames.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#8a7f72] whitespace-nowrap">成員篩選：</span>
              {devNames.map(name => (
                <button
                  key={name}
                  onClick={() => togglePersonFilter(name)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                    selectedPeople.includes(name)
                      ? 'bg-[#5b755e] text-white border-[#3e5240]'
                      : 'bg-[#fffdf9] text-[#8a7f72] border-[#d3cbbd] hover:border-[#8fb996]'
                  }`}
                >
                  {name}
                </button>
              ))}
              <button
                onClick={() => setSelectedPeople(selectedPeople.length === devNames.length ? [] : devNames)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold border-2 border-[#d3cbbd] bg-[#f4f1ea] text-[#8a7f72] hover:border-[#8fb996] transition-all"
              >
                {selectedPeople.length === devNames.length ? '全部取消' : '全選'}
              </button>
            </div>
          )}
        </div>

        {/* 阻礙事項彙整 */}
        {impediments.length > 0 && (
          <section className="bg-[#fffdf9] border-4 border-[#e6b1b1] rounded-3xl shadow-lg overflow-hidden">
            <div className="bg-[#fceded] border-b-4 border-[#e6b1b1] p-4 font-bold text-[#c96262] flex items-center gap-2">
              <span className="text-xl">⚠️</span> 阻礙事項彙整
              <span className="ml-1 text-sm font-normal bg-[#e6b1b1] text-white px-2 py-0.5 rounded-full">{impediments.length} 筆</span>
            </div>
            <div className="p-4 space-y-2">
              {impediments.map((imp, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-[#fdf6f6] border border-[#f0c8c8] rounded-2xl px-4 py-3">
                  <div className="text-xs font-bold text-[#c96262] bg-[#fceded] border border-[#e6b1b1] px-2 py-1 rounded-lg whitespace-nowrap shrink-0 mt-0.5">
                    {imp.day}{imp.date ? ` (${imp.date})` : ''}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[#5b755e] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {imp.person.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-[#3e362e]">{imp.person}</div>
                    <div className="text-sm text-[#6b5e50] mt-0.5 whitespace-pre-wrap">{imp.content}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 依日期視圖 */}
        {viewMode === 'date' && (
          <div className="space-y-3">
            {filteredEntries.length === 0 && !loading && (
              <div className="text-center py-16 text-[#b5a695] italic bg-[#fffdf9] rounded-3xl border-4 border-[#e8d5b5]">
                尚無日誌紀錄。<br />
                <span className="text-sm">請在 Daily Scrum 頁面填寫每日紀錄，或取消「僅顯示有紀錄天」的篩選。</span>
              </div>
            )}
            {filteredEntries.map(entry => {
              const isExpanded = expandedDays.has(entry.dayIndex);
              const hasImpediment = entry.records.some(r => r.q3 && r.q3.trim() && r.q3.trim() !== '無');
              const isWeekend = entry.dow === '週六' || entry.dow === '週日';
              return (
                <div key={entry.dayIndex} className={`bg-[#fffdf9] border-4 rounded-3xl shadow-sm overflow-hidden transition-all ${entry.isCompleted ? 'border-[#8fb996]' : isWeekend ? 'border-[#e8b4c0]' : 'border-[#d3cbbd]'}`}>
                  <button
                    onClick={() => toggleDay(entry.dayIndex)}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#f9f7f4] transition-colors"
                  >
                    <span className={`text-xl flex-shrink-0 ${entry.isCompleted ? '' : 'opacity-30'}`}>
                      {entry.isCompleted ? '✅' : (isWeekend ? '🌸' : '○')}
                    </span>
                    <div className="flex-1 flex items-center gap-3 min-w-0">
                      <span className="font-black text-[#3e362e] text-base">{entry.label}</span>
                      {entry.date && (
                        <span className={`text-sm font-bold ${isWeekend ? 'text-[#c9637a]' : 'text-[#8a7f72]'}`}>
                          {entry.date} {entry.dow}
                        </span>
                      )}
                    </div>
                    {hasImpediment && (
                      <span className="text-xs font-bold text-[#c96262] bg-[#fceded] border border-[#e6b1b1] px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                        ⚠ 有阻礙
                      </span>
                    )}
                    <span className="text-[#b5a695] text-sm flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {isExpanded && (
                    <div className="border-t-4 border-[#e8e4dc]">
                      {entry.records.length === 0 && (
                        <div className="px-5 py-4 text-[#b5a695] italic text-sm">所選成員在此天無紀錄</div>
                      )}
                      {entry.records.map((r, ri) => (
                        <div key={r.name} className={`px-5 py-4 ${ri > 0 ? 'border-t border-[#f0ece4]' : ''}`}>
                          {/* 人員標頭 */}
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-full bg-[#5b755e] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {r.name.charAt(0)}
                            </div>
                            <span className="font-bold text-[#3e362e]">{r.name}</span>
                          </div>
                          {/* 三欄記錄 */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-10">
                            <div className="bg-[#f9fcf8] border border-[#c8dcc8] rounded-xl p-3">
                              <div className="text-[10px] font-black text-[#5b755e] uppercase tracking-wide mb-1.5">🔄 昨天完成</div>
                              <div className="text-sm text-[#3e362e] whitespace-pre-wrap leading-relaxed">
                                {r.q1 || <span className="text-[#d3cbbd] italic">（無紀錄）</span>}
                              </div>
                            </div>
                            <div className="bg-[#fdf9f3] border border-[#dcc8a0] rounded-xl p-3">
                              <div className="text-[10px] font-black text-[#8b5a2b] uppercase tracking-wide mb-1.5">🎯 今天計劃</div>
                              <div className="text-sm text-[#3e362e] whitespace-pre-wrap leading-relaxed">
                                {r.q2 || <span className="text-[#d3cbbd] italic">（無紀錄）</span>}
                              </div>
                            </div>
                            <div className={`border rounded-xl p-3 ${r.q3 && r.q3 !== '無' ? 'bg-[#fdf6f6] border-[#e6b1b1]' : 'bg-[#fafaf9] border-[#e8e4dc]'}`}>
                              <div className={`text-[10px] font-black uppercase tracking-wide mb-1.5 ${r.q3 && r.q3 !== '無' ? 'text-[#c96262]' : 'text-[#8a7f72]'}`}>
                                🚧 阻礙事項
                              </div>
                              <div className={`text-sm whitespace-pre-wrap leading-relaxed ${r.q3 && r.q3 !== '無' ? 'text-[#c96262] font-bold' : 'text-[#b5a695] italic'}`}>
                                {r.q3 || '（無）'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 依人員視圖 */}
        {viewMode === 'person' && (
          <div className="space-y-4">
            {byPerson.length === 0 && !loading && (
              <div className="text-center py-16 text-[#b5a695] italic bg-[#fffdf9] rounded-3xl border-4 border-[#e8d5b5]">
                尚無日誌紀錄。
              </div>
            )}
            {byPerson.map(p => {
              const isExpanded = expandedPersons.has(p.name);
              const personImpediments = p.days.filter(d => d.record.q3 && d.record.q3.trim() !== '無' && d.record.q3.trim());
              const completedDaysCount = p.days.filter(d => d.isCompleted).length;
              return (
                <div key={p.name} className="bg-[#fffdf9] border-4 border-[#d3cbbd] rounded-3xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => togglePerson(p.name)}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#f9f7f4] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#5b755e] text-white flex items-center justify-center text-base font-black flex-shrink-0">
                      {p.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <span className="font-black text-[#3e362e] text-base">{p.name}</span>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-[#8a7f72]">✅ {completedDaysCount} 天完成</span>
                        <span className="text-xs text-[#8a7f72]">📝 {p.days.length} 天有紀錄</span>
                      </div>
                    </div>
                    {personImpediments.length > 0 && (
                      <span className="text-xs font-bold text-[#c96262] bg-[#fceded] border border-[#e6b1b1] px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                        ⚠ {personImpediments.length} 筆阻礙
                      </span>
                    )}
                    <span className="text-[#b5a695] text-sm flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {isExpanded && (
                    <div className="border-t-4 border-[#e8e4dc]">
                      {p.days.length === 0 && (
                        <div className="px-5 py-6 text-[#b5a695] italic text-sm">此成員尚無任何紀錄</div>
                      )}
                      {p.days.map((e, ei) => {
                        const isWeekend = e.dow === '週六' || e.dow === '週日';
                        return (
                          <div key={e.dayIndex} className={`px-5 py-4 ${ei > 0 ? 'border-t border-[#f0ece4]' : ''}`}>
                            <div className="flex items-center gap-2 mb-3">
                              <span className={`text-base ${e.isCompleted ? '' : 'opacity-30'}`}>{e.isCompleted ? '✅' : '○'}</span>
                              <span className="font-black text-[#3e362e]">{e.label}</span>
                              {e.date && (
                                <span className={`text-xs font-bold ${isWeekend ? 'text-[#c9637a]' : 'text-[#8a7f72]'}`}>
                                  {e.date} {e.dow}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pl-7">
                              <div className="bg-[#f9fcf8] border border-[#c8dcc8] rounded-xl p-3">
                                <div className="text-[10px] font-black text-[#5b755e] uppercase tracking-wide mb-1.5">🔄 昨天完成</div>
                                <div className="text-sm text-[#3e362e] whitespace-pre-wrap leading-relaxed">
                                  {e.record.q1 || <span className="text-[#d3cbbd] italic">（無紀錄）</span>}
                                </div>
                              </div>
                              <div className="bg-[#fdf9f3] border border-[#dcc8a0] rounded-xl p-3">
                                <div className="text-[10px] font-black text-[#8b5a2b] uppercase tracking-wide mb-1.5">🎯 今天計劃</div>
                                <div className="text-sm text-[#3e362e] whitespace-pre-wrap leading-relaxed">
                                  {e.record.q2 || <span className="text-[#d3cbbd] italic">（無紀錄）</span>}
                                </div>
                              </div>
                              <div className={`border rounded-xl p-3 ${e.record.q3 && e.record.q3 !== '無' ? 'bg-[#fdf6f6] border-[#e6b1b1]' : 'bg-[#fafaf9] border-[#e8e4dc]'}`}>
                                <div className={`text-[10px] font-black uppercase tracking-wide mb-1.5 ${e.record.q3 && e.record.q3 !== '無' ? 'text-[#c96262]' : 'text-[#8a7f72]'}`}>
                                  🚧 阻礙事項
                                </div>
                                <div className={`text-sm whitespace-pre-wrap leading-relaxed ${e.record.q3 && e.record.q3 !== '無' ? 'text-[#c96262] font-bold' : 'text-[#b5a695] italic'}`}>
                                  {e.record.q3 || '（無）'}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}
