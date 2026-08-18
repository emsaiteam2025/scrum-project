import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { lineMultiPush } from '@/lib/line';
import {
  assembleJournalRaw, buildDailyText, buildWeeklyText,
  isSprintInProgress, sprintProgressFromDoc, type SprintDoc,
} from '@/lib/journal';

const pad = (n: number) => String(n).padStart(2, '0');

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 台灣時間 UTC+8：把 UTC 位移 +8 小時後，一律用 getUTC* 讀「台灣牆上時間」
  const nowUtc = new Date();
  const tw = new Date(nowUtc.getTime() + 8 * 3600 * 1000);
  const taiwanHour = tw.getUTCHours();
  const taiwanDay = tw.getUTCDay(); // 0=日,1=一,...,6=六

  // 發送當天日期（推日報用）
  const todayIso = `${tw.getUTCFullYear()}-${pad(tw.getUTCMonth() + 1)}-${pad(tw.getUTCDate())}`;
  // 本週一～本週五（推週報用，週一為週首）
  const diffToMon = taiwanDay === 0 ? -6 : 1 - taiwanDay;
  const mon = new Date(tw); mon.setUTCDate(tw.getUTCDate() + diffToMon);
  const fri = new Date(mon); fri.setUTCDate(mon.getUTCDate() + 4);
  const weekFrom = `${mon.getUTCFullYear()}-${pad(mon.getUTCMonth() + 1)}-${pad(mon.getUTCDate())}`;
  const weekTo = `${fri.getUTCFullYear()}-${pad(fri.getUTCMonth() + 1)}-${pad(fri.getUTCDate())}`;

  // 以未登入 client SDK 讀 sprint（需線上規則允許 sprints 唯讀）
  const readSprint = async (id: string): Promise<SprintDoc | null> => {
    const snap = await getDoc(doc(db, 'sprints', id));
    return snap.exists() ? (snap.data() as SprintDoc) : null;
  };

  // 發送當下即時解析「這個使用者目前進行中的 Sprint」。
  // 舊做法是用排程文件裡的 cfg.sprintIds，那是使用者上次存排程／匯出日誌當下的快照：
  // 之後新開的 Sprint 永遠不會被加進去，於是出現「今天三個在跑、回報只有兩個」。
  // lineSchedule 的文件 id 就是使用者 uid，可直接拿來查他擁有的 sprint。
  const resolveActiveSprintIds = async (ownerId: string, carried: string[]): Promise<string[]> => {
    const ids: string[] = [];
    const seen = new Set<string>();
    const push = (id: string) => { if (!seen.has(id)) { seen.add(id); ids.push(id); } };
    const active = (d: unknown) =>
      isSprintInProgress(sprintProgressFromDoc(d as SprintDoc & { sprintStatus?: string }), todayIso);

    // 1) 自己擁有、目前進行中的
    try {
      const snap = await getDocs(query(collection(db, 'sprints'), where('ownerId', '==', ownerId)));
      snap.docs.forEach(d => { if (active(d.data())) push(d.id); });
    } catch { /* 查詢失敗就只靠下面的舊清單 */ }

    // 2) 排程存的舊清單裡、仍在進行中的：首頁的 Sprint 清單含「別人建立、我是協作者」
    //    的 Sprint，而協作查詢要 email、cron 只有 uid 查不到。若只取 ownerId 的結果，
    //    協作中的 Sprint 會從回報裡消失——那是拿一個 bug 換另一個。
    for (const id of carried) {
      if (seen.has(id)) continue;
      try {
        const d = await readSprint(id);
        if (d && active(d)) push(id);
      } catch { /* 單筆讀取失敗不影響其他 */ }
    }
    return ids;
  };

  const schedulesSnap = await getDocs(collection(db, 'lineSchedule'));
  const results: string[] = [];

  for (const docSnap of schedulesSnap.docs) {
    const cfg = docSnap.data() as LineScheduleDoc;
    if (!cfg.recipients?.length) continue;

    const wantDaily = cfg.dailyEnabled && taiwanHour === cfg.dailyHour && taiwanDay >= 1 && taiwanDay <= 5;
    const wantWeekly = cfg.weeklyEnabled && taiwanHour === cfg.weeklyHour && taiwanDay === cfg.weeklyDay;
    if (!wantDaily && !wantWeekly) continue;

    // 於「實際發送當下」用發送當天日期即時重算，避免推到別天的舊快照。
    // 清單同樣即時解析；查詢失敗或查不到進行中的 Sprint 時，才退回排程存的舊清單，
    // 避免因為一次查詢異常就整份不推播。都沒有才退回烤好的 lastDailyText/lastWeeklyText。
    const carried = cfg.sprintIds || [];
    let sprintIds: string[] = [];
    try { sprintIds = await resolveActiveSprintIds(docSnap.id, carried); } catch { sprintIds = []; }
    if (sprintIds.length === 0 && carried.length) sprintIds = carried;

    let raw = null;
    if (sprintIds.length) {
      try { raw = await assembleJournalRaw(sprintIds, readSprint); } catch { raw = null; }
    }

    if (wantDaily) {
      const text = raw ? buildDailyText(raw, todayIso) : cfg.lastDailyText;
      if (text) {
        await lineMultiPush(cfg.recipients, text);
        results.push(`daily→${docSnap.id}`);
      }
    }

    if (wantWeekly) {
      const text = raw ? buildWeeklyText(raw, weekFrom, weekTo) : cfg.lastWeeklyText;
      if (text) {
        await lineMultiPush(cfg.recipients, text);
        results.push(`weekly→${docSnap.id}`);
      }
    }
  }

  return NextResponse.json({ ok: true, taiwanHour, taiwanDay, todayIso, weekFrom, weekTo, sent: results });
}

interface LineScheduleDoc {
  recipients: string[];
  sprintIds?: string[];
  dailyEnabled: boolean;
  dailyHour: number;
  weeklyEnabled: boolean;
  weeklyDay: number;
  weeklyHour: number;
  lastDailyText?: string;
  lastWeeklyText?: string;
}
