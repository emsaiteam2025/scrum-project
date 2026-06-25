const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `// eslint-disable-next-line @typescript-eslint/no-unused-vars\n            let changed = false;\n            \n            // 1. 同步 Planning 新增或修改的 WHAT\n            whats.forEach((w: {id: string, text: string}) => {\n              const existingIndex = newTasks.findIndex(t => t.id === w.id);\n              if (existingIndex >= 0) {\n                if (newTasks[existingIndex].title !== w.text) {\n                  newTasks[existingIndex] = { ...newTasks[existingIndex], title: w.text };\n                  changed = true;\n                }\n              } else {\n                newTasks.push({\n                  id: w.id,\n                  type: 'pbi',\n                  status: 'pbi',\n                  title: w.text\n                });\n                changed = true;\n              }\n            });\n\n            // 2. 移除在 Planning 中已被刪除的 WHAT\n            const whatIds = whats.map((w: {id: string, text: string}) => w.id);\n            const tasksToRemove = newTasks.filter(t => t.type === 'pbi' && !whatIds.includes(t.id));\n            if (tasksToRemove.length > 0) {\n              newTasks = newTasks.filter(t => t.type !== 'pbi' || whatIds.includes(t.id));\n              changed = true;\n            }`,
  `            // 1. 同步 Planning 新增或修改的 WHAT
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
            }`
);

fs.writeFileSync(path, content);
console.log('removed unused changed var');