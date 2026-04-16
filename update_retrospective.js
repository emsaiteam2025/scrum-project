const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/retrospective/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `import React from 'react';`,
  `import React from 'react';\nimport { useAutoSave } from '@/hooks/useAutoSave';`
);

content = content.replace(
  `export default function SprintRetrospective() {\n  return (`,
  `export default function SprintRetrospective() {\n  const { data, updateData, loading } = useAutoSave('retrospective', {\n    keepStart: '',\n    problemStop: '',\n    actionItems: ''\n  });\n\n  return (`
);

content = content.replace(
  `placeholder="記錄團隊本次表現優異、值得保留或開始嘗試的作法..."\n              />`,
  `placeholder="記錄團隊本次表現優異、值得保留或開始嘗試的作法..."\n                value={data.keepStart}\n                onChange={e => updateData({ keepStart: e.target.value })}\n              />`
);

content = content.replace(
  `placeholder="記錄遇到的阻礙、問題或需要停止的不良習慣..."\n              />`,
  `placeholder="記錄遇到的阻礙、問題或需要停止的不良習慣..."\n                value={data.problemStop}\n                onChange={e => updateData({ problemStop: e.target.value })}\n              />`
);

content = content.replace(
  `placeholder="列出下個 Sprint 的具體改進行動項目..."\n              />`,
  `placeholder="列出下個 Sprint 的具體改進行動項目..."\n                value={data.actionItems}\n                onChange={e => updateData({ actionItems: e.target.value })}\n              />`
);

content = content.replace(
  `{/* 頂部：會議目標 */}`,
  `{/* Loading Overlay */}\n        {loading && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"><div className="bg-white px-6 py-4 rounded-xl font-bold text-[#5b755e] shadow-xl text-lg flex items-center gap-3"><span>💾</span> <span>載入資料中...</span></div></div>}\n\n        {/* 頂部：會議目標 */}`
);

fs.writeFileSync(path, content);
console.log('done');
