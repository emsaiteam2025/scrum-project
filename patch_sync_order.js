const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldSync = `            // 3. 確保順序與 Planning 的 WHAT 一致
            const pbis = newTasks.filter(t => t.type === 'pbi');
            const others = newTasks.filter(t => t.type !== 'pbi');
            pbis.sort((a, b) => {
              const idxA = whats.findIndex((w: {id: string, text: string}) => w.id === a.id);
              const idxB = whats.findIndex((w: {id: string, text: string}) => w.id === b.id);
              return idxA - idxB;
            });
            
            const orderedTasks = [...pbis, ...others];
            
            // 檢查順序是否改變
            const orderChanged = orderedTasks.map(t=>t.id).join(',') !== newTasks.map(t=>t.id).join(',');

            if (changed || orderChanged) {
              return orderedTasks;
            }
            return prev;`;

const newSync = `            // 將新進來的 PBI 與舊的任務合併 (不強制覆蓋使用者在 Backlog 自訂的排序)
            if (changed) {
              return newTasks;
            }
            return prev;`;

content = content.replace(oldSync, newSync);
fs.writeFileSync(path, content);
console.log('patched sync order');