const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('const [apiKey')) {
  content = content.replace(
    `const [editingTaskId, setEditingTaskId] = useState<string | null>(null);`,
    `const [editingTaskId, setEditingTaskId] = useState<string | null>(null);\n  const [apiKey, setApiKey] = useState('');\n  const [isAiLoading, setIsAiLoading] = useState(false);`
  );
}

if (!content.includes('localStorage.getItem(\'openai_api_key\')')) {
  content = content.replace(
    `const loadWhatsFromPlanning = async () => {`,
    `const savedKey = localStorage.getItem('openai_api_key');\n    if (savedKey) setApiKey(savedKey);\n\n    const loadWhatsFromPlanning = async () => {`
  );
}

const aiFunction = `  const handleAiGenerateTasks = async (pbiId: string, pbiTitle: string) => {
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

if (!content.includes('handleAiGenerateTasks')) {
  content = content.replace(
    `const handleDaysChange =`,
    `${aiFunction}\n\n  const handleDaysChange =`
  );
}

const oldTodoHeader = `<div className="flex justify-end mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => {
                             const newId = \`task-\${Date.now()}\`;
                             setTasks((prev) => [{ id: newId, type: 'task', status: 'todo', title: '', desc: '', role: '', time: '', pbiId: pbi.id }, ...prev]);
                             setEditingTaskId(newId);
                          }} className="text-xs font-bold bg-white border border-[#e6b1b1] text-[#c96262] px-2 py-1 rounded hover:bg-[#c96262] hover:text-white transition-colors shadow-sm">➕ 建立對齊此PBI的任務</button>
                       </div>`;

const newTodoHeader = `<div className="flex justify-end gap-1 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                             onClick={() => handleAiGenerateTasks(pbi.id, pbi.title)}
                             disabled={isAiLoading}
                             className="text-xs font-bold bg-white border border-[#a28bd4] text-[#a28bd4] px-2 py-1 rounded hover:bg-[#a28bd4] hover:text-white transition-colors shadow-sm disabled:opacity-50"
                          >
                             🤖 AI 拆解
                          </button>
                          <button onClick={() => {
                             const newId = \`task-\${Date.now()}\`;
                             setTasks((prev) => [{ id: newId, type: 'task', status: 'todo', title: '', desc: '', role: '', time: '', pbiId: pbi.id }, ...prev]);
                             setEditingTaskId(newId);
                          }} className="text-xs font-bold bg-white border border-[#e6b1b1] text-[#c96262] px-2 py-1 rounded hover:bg-[#c96262] hover:text-white transition-colors shadow-sm">➕ 建立任務</button>
                       </div>`;

content = content.replace(oldTodoHeader, newTodoHeader);

fs.writeFileSync(path, content);
console.log('patched backlog AI feature');
