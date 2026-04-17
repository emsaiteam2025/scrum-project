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
      // 使用 Gemini 3.1 Flash (經由 OpenAI 相容端點，不受瀏覽器 CORS 限制)
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gemini-3.1-flash",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || response.statusText || 'Unknown Gemini API Error');
      }
      const data = await response.json();
      aiContent = data.choices?.[0]?.message?.content || '';
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
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || response.statusText || 'Unknown OpenAI API Error');
      }
      const data = await response.json();
      aiContent = data.choices?.[0]?.message?.content || '';
    }

    return NextResponse.json({ result: aiContent });
  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
