const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/planning/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `import React, { useState, useRef } from 'react';`,
  `import React, { useState } from 'react';\nimport { useAutoSave } from '@/hooks/useAutoSave';`
);

content = content.replace(
`  const poIdeaRef = useRef<HTMLTextAreaElement>(null);
  const [apiKey, setApiKey] = useState('');
  const [projectName, setProjectName] = useState('');

  const [whys, setWhys] = useState([{ id: '1', text: '' }]);
  const [whats, setWhats] = useState([{ id: '1', text: '' }]);
  const [hows, setHows] = useState([{ id: '1', text: '' }]);`,
`  const [apiKey, setApiKey] = useState('');
  const [projectName, setProjectName] = useState('');

  const { data, updateData, loading } = useAutoSave('planning', {
    poIdea: '',
    timeLimit: '2',
    startDate: '',
    stakeholders: '利益關係人、專家',
    whys: [{ id: '1', text: '' }],
    whats: [{ id: '1', text: '' }],
    hows: [{ id: '1', text: '' }]
  });`
);

content = content.replace(
  `const poIdea = poIdeaRef.current?.value.trim() || '';`,
  `const poIdea = data.poIdea.trim() || '';`
);

content = content.replace(
  `{renderDynamicList(whys, setWhys, "請輸入價值描述...", 'WHY')}`,
  `{renderDynamicList(data.whys, (newItems) => updateData({ whys: typeof newItems === 'function' ? newItems(data.whys) : newItems }), "請輸入價值描述...", 'WHY')}`
);

content = content.replace(
  `{renderDynamicList(whats, setWhats, "請輸入具體功能模組...", 'WHAT')}`,
  `{renderDynamicList(data.whats, (newItems) => updateData({ whats: typeof newItems === 'function' ? newItems(data.whats) : newItems }), "請輸入具體功能模組...", 'WHAT')}`
);

content = content.replace(
  `{renderDynamicList(hows, setHows, "請輸入工作方式與工具...", 'HOW')}`,
  `{renderDynamicList(data.hows, (newItems) => updateData({ hows: typeof newItems === 'function' ? newItems(data.hows) : newItems }), "請輸入工作方式與工具...", 'HOW')}`
);

// Updates to form fields
content = content.replace(
  `<select className="px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner font-medium text-[#3e362e]" defaultValue="2">`,
  `<select className="px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner font-medium text-[#3e362e]" value={data.timeLimit} onChange={e => updateData({ timeLimit: e.target.value })}> `
);

content = content.replace(
  `<input type="date" className="px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner font-medium text-[#3e362e]" />`,
  `<input type="date" value={data.startDate} onChange={e => updateData({ startDate: e.target.value })} className="px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner font-medium text-[#3e362e]" />`
);

content = content.replace(
  `                  <ScrumTooltip keyword="PO" text="PO" />、\n                  <ScrumTooltip keyword="SM" text="SM" />、\n                  <ScrumTooltip keyword="DEVS" text="DEVS" />、其他（利益關係人、專家）`,
  `                  <ScrumTooltip keyword="PO" text="PO" />、\n                  <ScrumTooltip keyword="SM" text="SM" />、\n                  <ScrumTooltip keyword="DEVS" text="DEVS" />、<input type="text" value={data.stakeholders} onChange={e => updateData({ stakeholders: e.target.value })} className="bg-transparent border-b-2 border-[#b5a695] focus:border-[#8fb996] outline-none ml-1 placeholder-[#8a7f72]" placeholder="其他參與者" />`
);

content = content.replace(
  `<textarea \n                ref={poIdeaRef}`,
  `<textarea \n                value={data.poIdea}\n                onChange={e => updateData({ poIdea: e.target.value })}`
);

content = content.replace(
  `{/* Sprint Planning 模組 */}`,
  `{/* Loading Overlay */}\n        {loading && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"><div className="bg-white px-6 py-4 rounded-xl font-bold text-[#5b755e] shadow-xl text-lg flex items-center gap-3"><span>💾</span> <span>載入資料中...</span></div></div>}\n\n        {/* Sprint Planning 模組 */}`
);

fs.writeFileSync(path, content);
console.log('done');
