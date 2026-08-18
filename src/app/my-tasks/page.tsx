"use client";
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { BookOpen, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import AttachmentBox from '@/components/AttachmentBox';
import ProgressLog from '@/components/ProgressLog';
import { fetchAccessibleSprints } from '@/lib/sprints';
import {
  collectMyItems, isActiveSprint, updateSubtaskInSprint, updateTaskInSprint,
  appendNoteInSprint, deleteNoteInSprint, makeNote,
  type SprintDoc, type MyTaskItem,
} from '@/lib/myTasks';
import type { Attachment, Subtask, Task } from '@/lib/taskTypes';

const STATUS_LABEL: Record<'todo' | 'doing' | 'done', string> = {
  todo: '待辦', doing: '進行中', done: '完成',
};
const STATUS_STYLE: Record<'todo' | 'doing' | 'done', string> = {
  todo: 'bg-[#F0DDD3] text-[#B8543C]',
  doing: 'bg-[#F0E4C9] text-[#B8893A]',
  done: 'bg-[#DDE6D9] text-[#4F7E5C]',
};

export default function MyTasks() {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [sprints, setSprints] = useState<SprintDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'doing' | 'done'>('all');
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const list = await fetchAccessibleSprints<SprintDoc>({ uid: user.uid, email: user.email });
      setSprints(list);
    } catch (err) {
      console.error('[my-tasks] 載入失敗', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  const visibleSprints = includeCompleted ? sprints : sprints.filter(isActiveSprint);
  const items = collectMyItems(visibleSprints, user?.email)
    .filter(it => statusFilter === 'all' || it.status === statusFilter);

  const grouped = items.reduce<Record<string, MyTaskItem[]>>((acc, it) => {
    (acc[it.sprintId] = acc[it.sprintId] || []).push(it);
    return acc;
  }, {});

  const keyOf = (it: MyTaskItem) => `${it.sprintId}:${it.task.id}:${it.subtask?.id || 'task'}`;

  const applyLocal = (it: MyTaskItem, patch: { status?: MyTaskItem['status']; title?: string; attachments?: Attachment[] }) => {
    setSprints(prev => prev.map(s => {
      if (s.id !== it.sprintId) return s;
      const tasks = (s.backlog?.tasks || []).map(t => {
        if (t.id !== it.task.id) return t;
        if (!it.subtask) return { ...t, ...patch };
        return {
          ...t,
          subtasks: (t.subtasks || []).map(sub => sub.id === it.subtask!.id ? { ...sub, ...patch } : sub),
        };
      });
      return { ...s, backlog: { ...s.backlog, tasks } };
    }));
  };

  // 型別必須是 Partial<Subtask> & Partial<Task>，不能用 Record<string, unknown>
  // ——後者無法指派給 updateSubtaskInSprint 的 Partial<Subtask> 參數，會編譯失敗。
  const persist = async (it: MyTaskItem, patch: Partial<Subtask> & Partial<Task>) => {
    if (!user) return;
    const k = keyOf(it);
    setSaving(k);
    const actor = { email: user.email, displayName: user.displayName };
    try {
      if (it.subtask) {
        await updateSubtaskInSprint(it.sprintId, it.task.id, it.subtask.id, patch, actor);
      } else {
        await updateTaskInSprint(it.sprintId, it.task.id, patch, actor);
      }
    } catch (err) {
      console.error('[my-tasks] 儲存失敗', err);
      alert('儲存失敗，請重新整理後再試。');
      await load();
    } finally {
      setSaving(null);
    }
  };

  // 進度紀錄的追加／刪除必須在 transaction 內部操作，不能沿用 persist——
  // persist 送的是本機算好的完整欄位，兩人同時記錄會互相吃掉。
  const runNote = async (it: MyTaskItem, fn: () => Promise<void>) => {
    if (!user) return;
    setSaving(keyOf(it));
    try {
      await fn();
      await load();
    } catch (err) {
      console.error('[my-tasks] 進度紀錄失敗', err);
      alert('進度紀錄儲存失敗，請重新整理後再試。');
    } finally {
      setSaving(null);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-[#F6F3EB] flex items-center justify-center text-[#8B887E]">載入中…</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F6F3EB] flex flex-col items-center justify-center gap-4">
        <div className="text-[#5A574E]">請先登入才能看到指派給你的工作。</div>
        <button
          onClick={signInWithGoogle}
          className="bg-[#1F1D17] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#5A574E] transition-colors"
        >
          使用 Google 登入
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F3EB] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E9E5DA] text-[#5A574E] rounded-lg text-sm hover:shadow-sm transition-all"
          >
            <BookOpen size={15} strokeWidth={1.75} />
            回到專案大廳
          </Link>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E9E5DA] text-[#5A574E] rounded-lg text-sm hover:shadow-sm transition-all"
          >
            <RefreshCw size={14} strokeWidth={1.75} />
            重新整理
          </button>
        </div>

        <h1 className="text-xl font-semibold text-[#1F1D17] mb-1">我的工作</h1>
        <div className="text-sm text-[#8B887E] mb-4">
          {user.displayName || user.email}　共 {items.length} 項
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(['all', 'todo', 'doing', 'done'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                statusFilter === s
                  ? 'bg-[#1F1D17] text-white border-[#1F1D17]'
                  : 'bg-white text-[#5A574E] border-[#E9E5DA] hover:border-[#C96442]'
              }`}
            >
              {s === 'all' ? '全部' : STATUS_LABEL[s]}
            </button>
          ))}
          <label className="flex items-center gap-1.5 text-xs text-[#5A574E] ml-auto cursor-pointer">
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={e => setIncludeCompleted(e.target.checked)}
            />
            含已結束的專案
          </label>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-[#8B887E] text-sm py-8 justify-center">
            <Loader2 size={16} className="animate-spin" /> 載入中…
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-[#E9E5DA] rounded-xl p-8 text-center text-sm text-[#8B887E]">
            目前沒有指派給你的工作。<br />
            <span className="text-xs">
              請確認專案的 Sprint Planning 成員表已填入你的 Email（{user.email}），且任務已拆分出你的子任務。
            </span>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([sprintId, list]) => (
              <div key={sprintId}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-[#1F1D17]">{list[0].sprintName}</div>
                  <Link
                    href={`/backlog?sprint=${sprintId}`}
                    className="text-xs text-[#8B887E] hover:text-[#C96442]"
                  >
                    開啟看板 →
                  </Link>
                </div>
                <div className="space-y-2">
                  {list.map(it => {
                    const k = keyOf(it);
                    return (
                      <div key={k} className="bg-white border border-[#E9E5DA] rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <select
                            value={it.status}
                            onChange={e => {
                              const status = e.target.value as MyTaskItem['status'];
                              applyLocal(it, { status });
                              persist(it, { status });
                            }}
                            className={`text-[10px] font-medium px-1.5 py-1 rounded border-0 ${STATUS_STYLE[it.status]}`}
                          >
                            {(['todo', 'doing', 'done'] as const).map(s => (
                              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                            ))}
                          </select>
                          <span className="text-[10px] text-[#8B887E] bg-[#F6F3EB] px-1.5 py-0.5 rounded">
                            {it.subtask ? `子任務 · ${it.task.title}` : '任務'}
                          </span>
                          {saving === k && <Loader2 size={12} className="animate-spin text-[#8B887E]" />}
                        </div>
                        <input
                          type="text"
                          value={it.title}
                          onChange={e => applyLocal(it, { title: e.target.value })}
                          onBlur={e => persist(it, { title: e.target.value })}
                          className="w-full text-sm text-[#1F1D17] px-2 py-1.5 border border-[#E9E5DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5E4DA]"
                          placeholder="我負責的內容"
                        />
                        <AttachmentBox
                          attachments={(it.subtask ? it.subtask.attachments : it.task.attachments) || []}
                          sprintId={it.sprintId}
                          uploadedBy={user.email || ''}
                          onChange={next => {
                            applyLocal(it, { attachments: next });
                            persist(it, { attachments: next });
                          }}
                        />
                        <ProgressLog
                          notes={(it.subtask ? it.subtask.notes : it.task.notes) || []}
                          currentUserEmail={user.email || ''}
                          defaultOpen
                          onAppend={text => {
                            const actor = { email: user.email, displayName: user.displayName };
                            const n = makeNote(text, actor);
                            if (!n) return;
                            runNote(it, () => appendNoteInSprint(
                              it.sprintId, it.task.id, it.subtask?.id ?? null, n, actor));
                          }}
                          onDelete={noteId => runNote(it, () => deleteNoteInSprint(
                            it.sprintId, it.task.id, it.subtask?.id ?? null, noteId,
                            { email: user.email, displayName: user.displayName }))}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
