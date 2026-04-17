import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { apiKey, fieldType, currentText, poIdea } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key is required' }, { status: 400 });
    }

    let prompt = '';
    const fieldNameMap: any = {
      'WHY': 'Sprint Goal (為什麼要做)',
      'WHAT': 'Product Backlog Item / 具體交付物 (要做什麼)',
      'HOW': '執行計畫 / 拆解任務 (如何做)'
    };
    const fieldName = fieldNameMap[fieldType] || fieldType;

    if (currentText && currentText.trim() !== '') {
      prompt = `你是一個專業的 Scrum Master。請參考 PO 的初步想法：「${poIdea}」，將以下關於「${fieldName}」的草稿潤飾得更專業、清晰且具體。請直接回傳潤飾後的文字，不需要引言或額外說明。\n\n草稿：${currentText}`;
    } else {
      prompt = `你是一個專業的 Scrum Master。請根據 PO 的初步想法：「${poIdea}」，幫我發想一個具體的「${fieldName}」。請直接回傳發想的文字內容，不需要引言或額外說明，字數約 30 到 60 字內即可。`;
    }

    let aiContent = '';

    if (apiKey.startsWith('AIza')) {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7
        })
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
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'OpenAI API Error');
      }
      const data = await response.json();
      aiContent = data.choices?.[0]?.message?.content || '';
    }

    return NextResponse.json({ result: aiContent.trim() });
  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
