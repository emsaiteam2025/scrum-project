const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/hooks/useAutoSave.ts';
let content = fs.readFileSync(path, 'utf8');

const oldUpdate = `  const updateData = (updates: Partial<T>) => {
    setData(prev => ({ ...prev, ...updates }));
  };`;

const newUpdate = `  const updateData = (updates: Partial<T> | ((prev: T) => Partial<T>)) => {
    setData(prev => {
      const newUpdates = typeof updates === 'function' ? updates(prev) : updates;
      return { ...prev, ...newUpdates };
    });
  };`;

content = content.replace(oldUpdate, newUpdate);
fs.writeFileSync(path, content);
console.log('patched useAutoSave');