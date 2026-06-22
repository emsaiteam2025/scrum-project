import { createHmac } from 'crypto';

const LINE_API = 'https://api.line.me/v2/bot/message';
const MAX_CHARS = 4800;

export async function linePush(userId: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN not set');

  // 超過字數限制時分段發送
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, MAX_CHARS));
    remaining = remaining.slice(MAX_CHARS);
  }

  for (const chunk of chunks) {
    const res = await fetch(`${LINE_API}/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text: chunk }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`LINE push failed: ${JSON.stringify(err)}`);
    }
  }
}

export async function lineMultiPush(userIds: string[], text: string): Promise<void> {
  await Promise.all(userIds.map(id => linePush(id, text)));
}

export function verifyLineSignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return false;
  const hash = createHmac('SHA256', secret).update(body).digest('base64');
  return hash === signature;
}
