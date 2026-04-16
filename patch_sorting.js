const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Insert moveTask function
const moveTaskFunc = `
  const moveTask = (id: string, direction: number) => {
    setTasks((prev: Task[]) => {
      const index = prev.findIndex((t) => t.id === id);
      if (index === -1) return prev;
      const newTasks = [...prev];
      const task = newTasks[index];

      const groupTasks = newTasks.filter(
        (t) =>
          t.status === task.status &&
          t.type === task.type &&
          t.pbiId === task.pbiId
      );

      const groupIndex = groupTasks.findIndex((t) => t.id === id);
      if (direction === -1 && groupIndex > 0) {
        const targetId = groupTasks[groupIndex - 1].id;
        const targetIndex = newTasks.findIndex((t) => t.id === targetId);
        newTasks.splice(index, 1);
        newTasks.splice(targetIndex, 0, task);
      } else if (direction === 1 && groupIndex < groupTasks.length - 1) {
        const targetId = groupTasks[groupIndex + 1].id;
        const targetIndex = newTasks.findIndex((t) => t.id === targetId);
        newTasks.splice(index, 1);
        newTasks.splice(targetIndex, 0, task);
      }
      return newTasks;
    });
  };

  const updateTask = `;

content = content.replace('  const updateTask = ', moveTaskFunc);

// 2. Add Up/Down buttons to the hover menu
const oldButtons = `              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 absolute top-2 right-2 bg-white/80 p-1 rounded-lg shadow-sm">
                <button onClick={() => setEditingTaskId(task.id)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded-md" title="編輯">✏️</button>
                <button onClick={() => deleteTask(task.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-md" title="刪除">🗑️</button>
              </div>`;

const newButtons = `              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 absolute top-2 right-2 bg-white/80 p-1 rounded-lg shadow-sm z-10">
                <button onClick={() => moveTask(task.id, -1)} className="text-gray-500 hover:text-gray-700 bg-gray-50 p-1.5 rounded-md text-xs font-bold" title="向上排序">🔼</button>
                <button onClick={() => moveTask(task.id, 1)} className="text-gray-500 hover:text-gray-700 bg-gray-50 p-1.5 rounded-md text-xs font-bold" title="向下排序">🔽</button>
                <button onClick={() => setEditingTaskId(task.id)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded-md" title="編輯">✏️</button>
                <button onClick={() => deleteTask(task.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-md" title="刪除">🗑️</button>
              </div>`;

content = content.replace(oldButtons, newButtons);

fs.writeFileSync(path, content);
console.log("Sorting patch applied!");