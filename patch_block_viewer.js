const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/hooks/useAutoSave.ts';
let content = fs.readFileSync(path, 'utf8');

const oldUpdate = `  const updateData = (updates: Partial<T> | ((prev: T) => Partial<T>)) => {
    setData(prev => {
      const newUpdates = typeof updates === 'function' ? updates(prev) : updates;
      return { ...prev, ...newUpdates };
    });
  };`;

const newUpdate = `  const updateData = (updates: Partial<T> | ((prev: T) => Partial<T>)) => {
    if (sprintId) {
      const isPublicViewer = localStorage.getItem('sprintRole_' + sprintId) === 'viewer_via_link';
      // 如果是唯讀訪客，不允許修改本地 state (禁止編輯)
      if (isPublicViewer && !user) {
        alert('您目前為檢視者模式，無法編輯此專案！');
        return;
      }
    }

    setData(prev => {
      const newUpdates = typeof updates === 'function' ? updates(prev) : updates;
      return { ...prev, ...newUpdates };
    });
  };`;

content = content.replace(oldUpdate, newUpdate);
fs.writeFileSync(path, content);
console.log('patched updateData to block public viewers');