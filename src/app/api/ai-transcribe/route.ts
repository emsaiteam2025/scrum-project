import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const apiKey = formData.get('apiKey') as string;
    const audioFile = formData.get('audio') as File;

    if (!apiKey) return NextResponse.json({ error: 'API Key is required' }, { status: 400 });
    if (!audioFile) return NextResponse.json({ error: '音訊檔案不能為空' }, { status: 400 });

    let transcribedText = '';

    if (apiKey.startsWith('AIza')) {
      const audioBuffer = await audioFile.arrayBuffer();
      const base64Audio = Buffer.from(audioBuffer).toString('base64');
      const mimeType = audioFile.type || 'audio/webm';

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: '請將以下音訊內容完整轉錄為繁體中文文字，直接輸出轉錄文字，不需要任何說明或前綴：' },
                { inline_data: { mime_type: mimeType, data: base64Audio } }
              ]
            }]
          })
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'Gemini API Error');
      }

      const data = await response.json();
      transcribedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      const whisperForm = new FormData();
      whisperForm.append('file', audioFile, 'audio.webm');
      whisperForm.append('model', 'whisper-1');
      whisperForm.append('language', 'zh');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: whisperForm
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'OpenAI Whisper API Error');
      }

      const data = await response.json();
      transcribedText = data.text || '';
    }

    return NextResponse.json({ text: transcribedText.trim() });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[ai-transcribe]', error);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
