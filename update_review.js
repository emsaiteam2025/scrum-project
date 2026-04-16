const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/review/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `import React from 'react';`,
  `import React from 'react';\nimport { useAutoSave } from '@/hooks/useAutoSave';`
);

content = content.replace(
  `export default function SprintReview() {\n  return (`,
  `export default function SprintReview() {\n  const { data, updateData, loading } = useAutoSave('review', {\n    opening: '',\n    demo: '',\n    market: '',\n    future: ''\n  });\n\n  return (`
);

content = content.replace(
  `placeholder="總結本次 Sprint 的目標達成狀況..."\n              />`,
  `placeholder="總結本次 Sprint 的目標達成狀況..."\n                value={data.opening}\n                onChange={e => updateData({ opening: e.target.value })}\n              />`
);

content = content.replace(
  `placeholder="記錄展示的具體功能與現場反饋..."\n              />`,
  `placeholder="記錄展示的具體功能與現場反饋..."\n                value={data.demo}\n                onChange={e => updateData({ demo: e.target.value })}\n              />`
);

content = content.replace(
  `placeholder="討論市場變化、業務需求調整..."\n              />`,
  `placeholder="討論市場變化、業務需求調整..."\n                value={data.market}\n                onChange={e => updateData({ market: e.target.value })}\n              />`
);

content = content.replace(
  `placeholder="為下個 Sprint 或長期目標的建議..."\n              />`,
  `placeholder="為下個 Sprint 或長期目標的建議..."\n                value={data.future}\n                onChange={e => updateData({ future: e.target.value })}\n              />`
);

content = content.replace(
  `{/* 內容區塊 */}`,
  `{/* Loading Overlay */}\n        {loading && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"><div className="bg-white px-6 py-4 rounded-xl font-bold text-[#5b755e] shadow-xl text-lg flex items-center gap-3"><span>💾</span> <span>載入資料中...</span></div></div>}\n\n        {/* 內容區塊 */}`
);

fs.writeFileSync(path, content);
console.log('done');
