import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType, apiKey } = await req.json();

    if (!apiKey || !imageBase64) {
      return NextResponse.json({ error: '缺少 apiKey 或 imageBase64' }, { status: 400 });
    }

    if (!apiKey.startsWith('AIza')) {
      return NextResponse.json({ error: '照片還原功能需要 Gemini API Key（以 AIza 開頭）' }, { status: 400 });
    }

    const prompt = `你是一個 Scrum 任務看板分析專家。請仔細分析這張任務看板的照片，辨識出所有的 PBI（產品待辦項目）和任務卡片。

請回傳一個 JSON 陣列，格式如下（只回傳 JSON，不要有任何說明文字或 Markdown）：
[
  {
    "id": "photo-pbi-1",
    "type": "pbi",
    "status": "pbi",
    "title": "PBI 標題",
    "desc": "描述（若有）"
  },
  {
    "id": "photo-task-1",
    "type": "task",
    "status": "todo",
    "title": "任務標題",
    "desc": "描述（若有）",
    "role": "負責人（若有）",
    "time": "預估工時（若有）"
  }
]

規則：
- type 只能是 "pbi" 或 "task"
- PBI 的 status 固定為 "pbi"
- task 的 status 依看板欄位判斷：todo（待辦）、doing（進行中）、done（完成）、accepted（已驗收）
- id 請用 "photo-pbi-1", "photo-pbi-2"... 和 "photo-task-1", "photo-task-2"... 依序命名
- 若無法辨識某欄位，用空字串 ""
- 若看板中無任何任務，回傳空陣列 []`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } },
              { text: prompt }
            ]
          }],
          generationConfig: { temperature: 0.1 }
        })
      }
    );

    if (!response.ok) {
      let errMessage = response.statusText;
      try {
        const err = await response.json();
        errMessage = err?.error?.message || errMessage;
      } catch {}
      throw new Error(errMessage);
    }

    const data = await response.json();
    let aiContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    aiContent = aiContent.trim();

    // 擷取 JSON 陣列
    const startIdx = aiContent.indexOf('[');
    const endIdx = aiContent.lastIndexOf(']');
    if (startIdx !== -1 && endIdx !== -1) {
      aiContent = aiContent.substring(startIdx, endIdx + 1);
    }

    let tasks = [];
    try {
      tasks = JSON.parse(aiContent);
    } catch {
      throw new Error('Gemini 回傳格式無法解析，請重試');
    }

    return NextResponse.json({ tasks });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('ai-restore-backlog Error:', error);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
