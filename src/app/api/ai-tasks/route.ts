import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { pbiTitle, apiKey } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key is required' }, { status: 400 });
    }

    const prompt = `你是一個專業的 Scrum Master 與資深開發者。請幫我將以下 Product Backlog Item (PBI) 拆解成 3 到 5 個具體的 Task (待辦任務)。以 JSON 陣列格式回傳，每個任務包含 title (標題) 與 desc (簡短描述)。不要回傳 Markdown 標籤，直接回傳 JSON 陣列即可。例如：[{"title":"建立資料表", "desc":"建立 users 資料表"}]\n\nPBI: ${pbiTitle}`;

    let aiContent = '';

    if (apiKey.startsWith('AIza')) {
      // 原生 Gemini API (最穩定的 generateContent)
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 }
        })
      });

      if (!response.ok) {
        let errMessage = response.statusText;
        try {
          const err = await response.json();
          errMessage = err?.error?.message || err?.error || response.statusText;
        } catch {}
        throw new Error(errMessage || 'Unknown Gemini API Error');
      }
      const data = await response.json();
      aiContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      // 使用 OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "你是一個專業的 Scrum Master 與資深開發者。請幫我將以下 Product Backlog Item (PBI) 拆解成 3 到 5 個具體的 Task (待辦任務)。以 JSON 陣列格式回傳，每個任務包含 title (標題) 與 desc (簡短描述)。不要回傳 Markdown 標籤，直接回傳 JSON 陣列即可。例如：[{\"title\":\"建立資料表\", \"desc\":\"建立 users 資料表\"}]" },
            { role: "user", content: `PBI: ${pbiTitle}` }
          ],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        let errMessage = response.statusText;
        try {
          const err = await response.json();
          errMessage = err?.error?.message || response.statusText;
        } catch {}
        throw new Error(errMessage || 'Unknown OpenAI API Error');
      }
      const data = await response.json();
      aiContent = data.choices?.[0]?.message?.content || '';
    }

    return NextResponse.json({ result: aiContent });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API Route Error:", error);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}