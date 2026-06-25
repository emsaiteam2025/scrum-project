const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldLogic = `          setTasks(prev => {
            let newTasks = [...prev];
                        // 1. 同步 Planning 新增或修改的 WHAT
            whats.forEach((w: {id: string, text: string}) => {
              const existingIndex = newTasks.findIndex(t => t.id === w.id);
              if (existingIndex >= 0) {
                if (newTasks[existingIndex].title !== w.text) {
                  newTasks[existingIndex] = { ...newTasks[existingIndex], title: w.text };
                }
              } else {
                newTasks.push({
                  id: w.id,
                  type: 'pbi',
                  status: 'pbi',
                  title: w.text
                });
              }
            });

            // 2. 移除在 Planning 中已被刪除的 WHAT
            const whatIds = whats.map((w: {id: string, text: string}) => w.id);
            const tasksToRemove = newTasks.filter(t => t.type === 'pbi' && !whatIds.includes(t.id));
            if (tasksToRemove.length > 0) {
              newTasks = newTasks.filter(t => t.type !== 'pbi' || whatIds.includes(t.id));
            }

            // 將新進來的 PBI 與舊的任務合併 (不強制覆蓋使用者在 Backlog 自訂的排序)
            // 找出所有存在於 prev，但沒有在 newTasks 裡的 task
            const oldTasks = prev.filter(pt => pt.type === 'task');
            
            // 將 planning 產生的新 PBI 與舊的 tasks 組合起來
            let mergedTasks = [...newTasks, ...oldTasks];
            
            // 恢復 PBI 既有的狀態 (使用者如果移動了 PBI 的泳道，也要保留)
            mergedTasks = mergedTasks.map(mt => {
              const existing = prev.find(pt => pt.id === mt.id);
              if (existing) {
                // PBI 的 title 以 planning 為準，其餘狀態 (包含 status) 以 Backlog 為準
                return mt.type === 'pbi' ? { ...existing, title: mt.title } : existing;
              }
              return mt;
            });
            
            // 由於陣列順序每次 mapping 都可能導致 stringify 不一致，改用比對內容核心屬性來判斷是否有實際變更
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hashTask = (t: any) => \`\${t.id}|\${t.title}|\${t.desc}|\${t.status}|\${t.role}|\${t.time}|\${t.pbiId}\`;
            const prevHash = prev.map(hashTask).sort().join(',');
            const mergedHash = mergedTasks.map(hashTask).sort().join(',');
            
            if (prevHash !== mergedHash) {
               return mergedTasks;
            }
            
            return prev;
          });`;

const newLogic = `          setTasks(prev => {
            let newPbis = prev.filter(t => t.type === 'pbi');
            let tasksList = prev.filter(t => t.type === 'task');
            
            // 1. 同步 Planning 新增或修改的 WHAT (只針對 PBI)
            whats.forEach((w: {id: string, text: string}) => {
              const existingIndex = newPbis.findIndex(t => t.id === w.id);
              if (existingIndex >= 0) {
                if (newPbis[existingIndex].title !== w.text) {
                  newPbis[existingIndex] = { ...newPbis[existingIndex], title: w.text };
                }
              } else {
                newPbis.push({
                  id: w.id,
                  type: 'pbi',
                  status: 'pbi',
                  title: w.text
                });
              }
            });

            // 2. 移除在 Planning 中已被刪除的 WHAT (只針對 PBI)
            const whatIds = whats.map((w: {id: string, text: string}) => w.id);
            newPbis = newPbis.filter(t => whatIds.includes(t.id));

            // 將同步好的 PBI 與原本的 Tasks 合併
            let mergedTasks = [...newPbis, ...tasksList];
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hashTask = (t: any) => \`\${t.id}|\${t.title}|\${t.desc}|\${t.status}|\${t.role}|\${t.time}|\${t.pbiId}\`;
            const prevHash = prev.map(hashTask).sort().join(',');
            const mergedHash = mergedTasks.map(hashTask).sort().join(',');
            
            if (prevHash !== mergedHash) {
               return mergedTasks;
            }
            
            return prev;
          });`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync(path, content);
console.log('patched duplicate array merge logic');