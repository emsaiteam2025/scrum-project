import { NextResponse } from 'next/server';

const levelInstructions: Record<string, string> = {
  '詳細': '請以詳細、完整的方式整理以下內容，保留所有重要資訊，結構清晰，可分段呈現，字數不限。',
  '適中': '請以適中的篇幅整理以下內容，保留主要重點，去除重複或冗餘資訊，以條列或分段呈現，字數約 100-200 字。',
  '精簡': '請以最精簡的方式整理以下內容，只保留最核心的重點，以 3-5 個條列式短句呈現，字數約 50-100 字。',
};

export async function POST(req: Request) {
  try {
    const { apiKey, text, level, fieldName } = await req.json();

    if (!apiKey) return NextResponse.json({ error: 'API Key is required' }, { status: 400 });
    if (!text?.trim()) return NextResponse.json({ error: '內容不能為空' }, { status: 400 });

    const instruction = levelInstructions[level] ?? levelInstructions['適中'];
    const prompt = `你是一個專業的 Scrum Master，正在處理 Sprint Review「${fieldName}」議程的紀錄。\n\n${instruction}\n\n請直接回傳整理後的文字，不需要引言或額外說明。\n\n原始內容：\n${text}`;

    let aiContent = '';

    if (apiKey.startsWith('AIza')) {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'gemini-2.5-flash', messages: [{ role: 'user', content: prompt }], temperature: 0.5 })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'Gemini API Error');
      }
      const data = await response.json();
      aiContent = data.choices?.[0]?.message?.content || '';
    } else {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.5 })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'OpenAI API Error');
      }
      const data = await response.json();
      aiContent = data.choices?.[0]?.message?.content || '';
    }

    return NextResponse.json({ result: aiContent.trim() });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[ai-voice-summary]', error);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
