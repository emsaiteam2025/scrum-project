const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldLogic = `            // 將新進來的 PBI 與舊的任務合併 (不強制覆蓋使用者在 Backlog 自訂的排序)
            // 修改：不管 Planning 有沒有變化，對於本來就存在於 prev 的普通 task (type === 'task')，
            // 我們都要從 prev 裡面把它們補回來，這樣使用者編輯的 Task 就不會因為同步機制被洗掉了！
            
            if (changed) {
              return newTasks;
            }
            return prev;`;

const newLogic = `            // 將新進來的 PBI 與舊的任務合併 (不強制覆蓋使用者在 Backlog 自訂的排序)
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
            const hashTask = (t: any) => \`\${t.id}|\${t.title}|\${t.desc}|\${t.status}|\${t.role}|\${t.time}|\${t.pbiId}\`;
            const prevHash = prev.map(hashTask).sort().join(',');
            const mergedHash = mergedTasks.map(hashTask).sort().join(',');
            
            if (prevHash !== mergedHash) {
               return mergedTasks;
            }
            
            return prev;`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync(path, content);
console.log('patched merge array logic safely');