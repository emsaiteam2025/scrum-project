const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldSetTasks = `  const setTasks = (valOrFn: Task[] | ((prev: Task[]) => Task[])) => {
    if (typeof valOrFn === 'function') {
      updateData({ tasks: valOrFn(data.tasks) });
    } else {
      updateData({ tasks: valOrFn });
    }
  };`;

const newSetTasks = `  const setTasks = (valOrFn: Task[] | ((prev: Task[]) => Task[])) => {
    updateData((prevData: any) => ({
      tasks: typeof valOrFn === 'function' ? valOrFn(prevData.tasks) : valOrFn
    }));
  };`;

content = content.replace(oldSetTasks, newSetTasks);
fs.writeFileSync(path, content);
console.log('patched setTasks');