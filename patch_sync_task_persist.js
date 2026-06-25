const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldSync = `            // 將新進來的 PBI 與舊的任務合併 (不強制覆蓋使用者在 Backlog 自訂的排序)
            // 修改：確保在沒有變化的情況下，也能保留畫面上已經編輯好的 task
            if (changed) {
              // 對於新舊交替，如果有相同的任務 ID，以 prev 裡面的為主 (保留使用者輸入的編輯進度)
              // 只有 title 從 planning 修改過才覆蓋
              return newTasks.map(nt => {
                const existing = prev.find(pt => pt.id === nt.id);
                if (existing) {
                  // 如果是 PBI，更新 title；如果是普通任務，直接套用畫面上的
                  return nt.type === 'pbi' ? { ...existing, title: nt.title } : existing;
                }
                return nt;
              });
            }
            return prev;`;

const newSync = `            // 將新進來的 PBI 與舊的任務合併 (不強制覆蓋使用者在 Backlog 自訂的排序)
            // 修改：不管 Planning 有沒有變化，對於本來就存在於 prev 的普通 task (type === 'task')，
            // 我們都要從 prev 裡面把它們補回來，這樣使用者編輯的 Task 就不會因為同步機制被洗掉了！
            
            // 找出所有存在於 prev，但沒有在 newTasks 裡的 task
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

content = content.replace(oldSync, newSync);
fs.writeFileSync(path, content);
console.log('patched sync task persistence');