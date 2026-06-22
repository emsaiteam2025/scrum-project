import { NextRequest, NextResponse } from 'next/server';
import { lineMultiPush } from '@/lib/line';

export async function POST(req: NextRequest) {
  try {
    const { recipients, text } = await req.json() as { recipients: string[]; text: string };

    if (!recipients?.length) return NextResponse.json({ error: '無收件人' }, { status: 400 });
    if (!text?.trim()) return NextResponse.json({ error: '內容為空' }, { status: 400 });

    await lineMultiPush(recipients, text);
    return NextResponse.json({ ok: true, sent: recipients.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
