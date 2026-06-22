import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { verifyLineSignature } from '@/lib/line';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-line-signature') || '';

  if (!verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: { events: LineEvent[] };
  try { body = JSON.parse(rawBody); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  for (const event of body.events || []) {
    const userId = event.source?.userId;
    if (!userId) continue;

    if (event.type === 'follow' || event.type === 'message') {
      const displayName = await getLineProfile(userId);
      await setDoc(doc(db, 'lineUsers', userId), {
        lineUserId: userId,
        displayName,
        addedAt: Date.now(),
      }, { merge: true });
    }

    if (event.type === 'unfollow') {
      await setDoc(doc(db, 'lineUsers', userId), { blocked: true }, { merge: true });
    }
  }

  return NextResponse.json({ ok: true });
}

async function getLineProfile(userId: string): Promise<string> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return userId;
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return userId;
    const data = await res.json();
    return data.displayName || userId;
  } catch { return userId; }
}

interface LineEvent {
  type: string;
  source?: { userId?: string };
}
