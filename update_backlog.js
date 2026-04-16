const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `import React, { useState, useEffect } from 'react';`,
  `import React, { useState, useEffect } from 'react';\nimport { useAutoSave } from '@/hooks/useAutoSave';`
);

content = content.replace(
  `  const [sprintDays, setSprintDays] = useState<number | string>(30);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  useEffect(() => {
    const savedDays = localStorage.getItem('sprintDays');
    if (savedDays) {
      setSprintDays(Number(savedDays));
    }
  }, []);`,
  `  const [errorMsg, setErrorMsg] = useState<string>('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const { data, updateData, loading } = useAutoSave('backlog', {
    sprintDays: 30 as number | string,
    tasks: initialTasks,
    sprintGoal: '',
    stakeholders: ''
  });

  const sprintDays = data.sprintDays;
  const tasks = data.tasks;
  const setTasks = (valOrFn) => {
    if (typeof valOrFn === 'function') {
      updateData({ tasks: valOrFn(data.tasks) });
    } else {
      updateData({ tasks: valOrFn });
    }
  };

  useEffect(() => {
    if (sprintDays) {
      localStorage.setItem('sprintDays', sprintDays.toString());
    }
  }, [sprintDays]);`
);

content = content.replace(
  `setSprintDays(30);`,
  `updateData({ sprintDays: 30 });`
);
content = content.replace(
  `setSprintDays(1);`,
  `updateData({ sprintDays: 1 });`
);
content = content.replace(
  `setSprintDays(num);`,
  `updateData({ sprintDays: num });`
);
content = content.replace(
  `setSprintDays('');`,
  `updateData({ sprintDays: '' });`
);

content = content.replace(
  `placeholder="輸入本期主要目標..." \n              />`,
  `placeholder="輸入本期主要目標..." \n                value={data.sprintGoal}\n                onChange={e => updateData({ sprintGoal: e.target.value })}\n              />`
);

content = content.replace(
  `placeholder="輸入相關業務單位或高管..." \n              />`,
  `placeholder="輸入相關業務單位或高管..." \n                value={data.stakeholders}\n                onChange={e => updateData({ stakeholders: e.target.value })}\n              />`
);

content = content.replace(
  `{/* 頂部：Sprint 資訊欄位 */}`,
  `{/* Loading Overlay */}\n        {loading && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"><div className="bg-white px-6 py-4 rounded-xl font-bold text-[#5b755e] shadow-xl text-lg flex items-center gap-3"><span>💾</span> <span>載入資料中...</span></div></div>}\n\n        {/* 頂部：Sprint 資訊欄位 */}`
);

fs.writeFileSync(path, content);
console.log('done');
