const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 尋找舊的 function
const startIndex = content.indexOf('  const handleAiGenerateTasks = async');
const endIndex = content.indexOf('  const handleDaysChange =');

if (startIndex !== -1 && endIndex !== -1) {
  const oldBlock = content.substring(startIndex, endIndex);

  const newFunc = `  const handleAiGenerateTasks = async (pbiId: string, pbiTitle: string) => {
    if (!apiKey) {
      alert('⚠️ 請先於頁面設定 API Key (OpenAI 或 Gemini 均可)，才能啟動 AI 拆解任務功能！');
      return;
    }
    setIsAiLoading(true);
    try {
      const response = await fetch('/api/ai-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pbiTitle, apiKey })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || '後端請求失敗');
      }

      const data = await response.json();
      let aiContent = data.result || '';
      aiContent = aiContent.trim();
      
      const startIdx = aiContent.indexOf('[');
      const endIdx = aiContent.lastIndexOf(']');
      if (startIdx !== -1 && endIdx !== -1) {
        aiContent = aiContent.substring(startIdx, endIdx + 1);
      }
      
      let parsedTasks = [];
      try {
        parsedTasks = JSON.parse(aiContent);
      } catch (parseErr) {
        console.error("JSON 解析失敗，原始字串為:", aiContent);
        throw new Error("AI 回傳的格式不正確，無法解析為 JSON");
      }
      
      setTasks((prev) => {
        const newTasks = parsedTasks.map((t: any, i: number) => ({
          id: \`task-\${Date.now()}-\${i}\`,
          type: 'task',
          status: 'todo',
          title: t.title,
          desc: t.desc,
          role: '',
          time: '',
          pbiId: pbiId
        }));
        return [...newTasks, ...prev];
      });
      
    } catch (err: any) {
      console.error('AI Generate Error:', err);
      alert('產生失敗：' + (err.message || '未知錯誤') + '\\n請確認 API Key 是否有效，或查看 Console 了解詳細錯誤。');
    } finally {
      setIsAiLoading(false);
    }
  };

`;

  content = content.replace(oldBlock, newFunc);
  fs.writeFileSync(path, content);
  console.log('patched to use api route');
} else {
  console.log('could not find block');
}