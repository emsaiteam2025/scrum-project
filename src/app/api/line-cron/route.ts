import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { lineMultiPush } from '@/lib/line';
import { assembleJournalRaw, buildDailyText, buildWeeklyText, type SprintDoc } from '@/lib/journal';

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

  const schedulesSnap = await getDocs(collection(db, 'lineSchedule'));
  const results: string[] = [];

  for (const docSnap of schedulesSnap.docs) {
    const cfg = docSnap.data() as LineScheduleDoc;
    if (!cfg.recipients?.length) continue;

    const wantDaily = cfg.dailyEnabled && taiwanHour === cfg.dailyHour && taiwanDay >= 1 && taiwanDay <= 5;
    const wantWeekly = cfg.weeklyEnabled && taiwanHour === cfg.weeklyHour && taiwanDay === cfg.weeklyDay;
    if (!wantDaily && !wantWeekly) continue;

    // 於「實際發送當下」用發送當天日期即時重算，避免推到別天的舊快照。
    // 舊資料若尚無 sprintIds，回退到既有的 lastDailyText/lastWeeklyText。
    let raw = null;
    if (cfg.sprintIds?.length) {
      try { raw = await assembleJournalRaw(cfg.sprintIds, readSprint); } catch { raw = null; }
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
