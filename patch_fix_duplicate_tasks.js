const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldLogic = `            // 找出所有存在於 prev，但沒有在 newTasks 裡的 task
            // (因為 newTasks 目前只有根據 whats 產生的 PBI)
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
            
            // 確認真的有變更才觸發 setState，避免無限迴圈觸發儲存
            if (JSON.stringify(mergedTasks) !== JSON.stringify(prev)) {
               return mergedTasks;
            }
            
            return prev;`;

const newLogic = `            if (changed) {
              return newTasks;
            }
            return prev;`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync(path, content);
console.log('patched duplicate loop');