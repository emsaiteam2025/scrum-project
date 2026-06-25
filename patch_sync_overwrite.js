const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldSync = `            // 將新進來的 PBI 與舊的任務合併 (不強制覆蓋使用者在 Backlog 自訂的排序)
            if (changed) {
              return newTasks;
            }
            return prev;`;

const newSync = `            // 將新進來的 PBI 與舊的任務合併 (不強制覆蓋使用者在 Backlog 自訂的排序)
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

content = content.replace(oldSync, newSync);
fs.writeFileSync(path, content);
console.log('patched sync overwrite issue');