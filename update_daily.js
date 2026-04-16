const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/daily-scrum/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `import React, { useState, useEffect } from 'react';`,
  `import React, { useState, useEffect } from 'react';\nimport { useAutoSave } from '@/hooks/useAutoSave';`
);

content = content.replace(
  `  const [sprintDays, setSprintDays] = useState<number>(30);
  const [completedDays, setCompletedDays] = useState<boolean[]>([]);

  useEffect(() => {
    // 取得使用者設定的天數，預設 30
    const savedDays = localStorage.getItem('sprintDays');
    const daysCount = savedDays ? Number(savedDays) : 30;
    setSprintDays(daysCount);
    
    // 初始化打卡狀態陣列長度
    setCompletedDays(Array(daysCount).fill(false));
  }, []);

  const toggleDay = (index: number) => {
    const newDays = [...completedDays];
    newDays[index] = !newDays[index];
    setCompletedDays(newDays);
  };`,
  `  const [sprintDays, setSprintDays] = useState<number>(30);

  const { data, updateData, loading } = useAutoSave('daily', {
    completedDays: [] as boolean[]
  });

  const completedDays = data.completedDays;

  useEffect(() => {
    // 取得使用者設定的天數，預設 30
    const savedDays = localStorage.getItem('sprintDays');
    const daysCount = savedDays ? Number(savedDays) : 30;
    setSprintDays(daysCount);
    
    // 若初始化狀態為空或長度不對，則初始化
    if (completedDays.length !== daysCount && !loading) {
      updateData({ completedDays: Array(daysCount).fill(false) });
    }
  }, [loading]);

  const toggleDay = (index: number) => {
    const newDays = [...completedDays];
    newDays[index] = !newDays[index];
    updateData({ completedDays: newDays });
  };`
);

content = content.replace(
  `{/* 頂部：會議資訊 */}`,
  `{/* Loading Overlay */}\n        {loading && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"><div className="bg-white px-6 py-4 rounded-xl font-bold text-[#5b755e] shadow-xl text-lg flex items-center gap-3"><span>💾</span> <span>載入資料中...</span></div></div>}\n\n        {/* 頂部：會議資訊 */}`
);

fs.writeFileSync(path, content);
console.log('done');
