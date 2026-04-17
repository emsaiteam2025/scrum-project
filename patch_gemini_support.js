const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldFunc = `  const handleAiGenerateTasks = async (pbiId: string, pbiTitle: string) => {
    if (!apiKey) {
      alert('⚠️ 請先於 Sprint Planning 頁面設定 OpenAI API Key，才能啟動 AI 拆解任務功能！');
      return;
    }
    setIsAiLoading(true);
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${apiKey}\`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "你是一個專業的 Scrum Master 與資深開發者。請幫我將以下 Product Backlog Item (PBI) 拆解成 3 到 5 個具體的 Task (待辦任務)。以 JSON 陣列格式回傳，每個任務包含 title (標題) 與 desc (簡短描述)。不要回傳 Markdown 標籤，直接回傳 JSON 陣列即可。例如：[{\\"title\\":\\"建立資料表\\", \\"desc\\":\\"建立 users 資料表\\"}]"
            },
            {
              role: "user",
              content: \`PBI: \${pbiTitle}\`
            }
          ],
          temperature: 0.7,
        })
      });

      if (!response.ok) throw new Error('API 請求失敗');
      
      const data = await response.json();
      let aiContent = data.choices[0].message.content.trim();
      
      // 過濾 Markdown 語法 (以防 AI 還是輸出了)
      aiContent = aiContent.replace(/^\\s*\`\`\`(json)?/m, '').replace(/\`\`\`\\s*$/m, '');
      
      const parsedTasks = JSON.parse(aiContent);
      
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
      
    } catch (err) {
      console.error(err);
      alert('產生失敗，請確認 API Key 是否有效。');
    } finally {
      setIsAiLoading(false);
    }
  };`;

const newFunc = `  const handleAiGenerateTasks = async (pbiId: string, pbiTitle: string) => {
    if (!apiKey) {
      alert('⚠️ 請先於頁面設定 API Key (OpenAI 或 Gemini 均可)，才能啟動 AI 拆解任務功能！');
      return;
    }
    setIsAiLoading(true);
    try {
      let aiContent = '';
      const prompt = \`你是一個專業的 Scrum Master 與資深開發者。請幫我將以下 Product Backlog Item (PBI) 拆解成 3 到 5 個具體的 Task (待辦任務)。以 JSON 陣列格式回傳，每個任務包含 title (標題) 與 desc (簡短描述)。不要回傳 Markdown 標籤，直接回傳 JSON 陣列即可。例如：[{"title":"建立資料表", "desc":"建立 users 資料表"}]\\n\\nPBI: \${pbiTitle}\`;

      if (apiKey.startsWith('AIza')) {
        // 使用 Google Gemini API
        const response = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\${apiKey}\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7 }
          })
        });
        if (!response.ok) throw new Error('Gemini API 請求失敗');
        const data = await response.json();
        aiContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        // 使用 OpenAI API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${apiKey}\`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "你是一個專業的 Scrum Master 與資深開發者。請幫我將以下 Product Backlog Item (PBI) 拆解成 3 到 5 個具體的 Task (待辦任務)。以 JSON 陣列格式回傳，每個任務包含 title (標題) 與 desc (簡短描述)。不要回傳 Markdown 標籤，直接回傳 JSON 陣列即可。例如：[{\\"title\\":\\"建立資料表\\", \\"desc\\":\\"建立 users 資料表\\"}]" },
              { role: "user", content: \`PBI: \${pbiTitle}\` }
            ],
            temperature: 0.7,
          })
        });
        if (!response.ok) throw new Error('OpenAI API 請求失敗');
        const data = await response.json();
        aiContent = data.choices?.[0]?.message?.content || '';
      }
      
      aiContent = aiContent.trim();
      // 過濾 Markdown 語法 (以防 AI 還是輸出了)
      aiContent = aiContent.replace(/^\\s*\`\`\`(json)?/mi, '').replace(/\`\`\`\\s*$/m, '').trim();
      
      const parsedTasks = JSON.parse(aiContent);
      
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
      
    } catch (err) {
      console.error(err);
      alert('產生失敗，請確認 API Key 是否有效。');
    } finally {
      setIsAiLoading(false);
    }
  };`;
  
content = content.replace(oldFunc, newFunc);
fs.writeFileSync(path, content);
console.log('patched handleAiGenerateTasks');