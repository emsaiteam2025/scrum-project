import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { lineMultiPush } from '@/lib/line';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 台灣時間 UTC+8
  const nowUtc = new Date();
  const taiwanHour = (nowUtc.getUTCHours() + 8) % 24;
  const taiwanDay = new Date(nowUtc.getTime() + 8 * 3600 * 1000).getUTCDay();

  const schedulesSnap = await getDocs(collection(db, 'lineSchedule'));
  const results: string[] = [];

  for (const docSnap of schedulesSnap.docs) {
    const cfg = docSnap.data() as LineScheduleDoc;
    if (!cfg.recipients?.length) continue;

    if (cfg.dailyEnabled && taiwanHour === cfg.dailyHour && taiwanDay >= 1 && taiwanDay <= 5) {
      const text = cfg.lastDailyText;
      if (text) {
        await lineMultiPush(cfg.recipients, text);
        results.push(`daily→${docSnap.id}`);
      }
    }

    if (cfg.weeklyEnabled && taiwanHour === cfg.weeklyHour && taiwanDay === cfg.weeklyDay) {
      const text = cfg.lastWeeklyText;
      if (text) {
        await lineMultiPush(cfg.recipients, text);
        results.push(`weekly→${docSnap.id}`);
      }
    }
  }

  return NextResponse.json({ ok: true, taiwanHour, taiwanDay, sent: results });
}

interface LineScheduleDoc {
  recipients: string[];
  dailyEnabled: boolean;
  dailyHour: number;
  weeklyEnabled: boolean;
  weeklyDay: number;
  weeklyHour: number;
  lastDailyText?: string;
  lastWeeklyText?: string;
}
