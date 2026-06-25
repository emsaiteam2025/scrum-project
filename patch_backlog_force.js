const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `const { data, updateData, loading } = useAutoSave('backlog', {`,
  `const { data, updateData, loading, forceSave } = useAutoSave('backlog', {`
);

const oldBtn1 = `<button 
                  onClick={() => {
                    if (!task.title.trim()) {
                      updateTask(task.id, 'title', '未命名項目');
                    }
                    setEditingTaskId(null);
                  }}
                  className="flex-1 bg-[#8fb996] text-white text-xs font-bold py-2 rounded hover:bg-[#5b755e] transition-colors"
                >
                  確認張貼
                </button>`;

const newBtn1 = `<button 
                  onClick={() => {
                    if (!task.title.trim()) {
                      updateTask(task.id, 'title', '未命名項目');
                    }
                    setEditingTaskId(null);
                    setTimeout(() => forceSave && forceSave(), 50); // 確保狀態更新後立即觸發存檔
                  }}
                  className="flex-1 bg-[#8fb996] text-white text-xs font-bold py-2 rounded hover:bg-[#5b755e] transition-colors"
                >
                  確認張貼
                </button>`;

const oldBtn2 = `<button onClick={() => setEditingTaskId(null)} className="text-xs font-bold bg-[#5b755e] text-white px-3 py-1 rounded hover:bg-[#4a614d] transition-colors">完成</button>`;
const newBtn2 = `<button onClick={() => { setEditingTaskId(null); setTimeout(() => forceSave && forceSave(), 50); }} className="text-xs font-bold bg-[#5b755e] text-white px-3 py-1 rounded hover:bg-[#4a614d] transition-colors">完成</button>`;

content = content.replace(oldBtn1, newBtn1);
content = content.replace(oldBtn2, newBtn2);
fs.writeFileSync(path, content);
console.log('patched Backlog forceSave');