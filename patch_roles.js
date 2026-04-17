const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/planning/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add fields to initial state
content = content.replace(
  "stakeholders: '利益關係人、專家',",
  "stakeholders: '利益關係人、專家',\n    po: '',\n    sm: '',\n    devs: '',"
);

// 2. Replace UI
const oldUI = `<div className="px-4 py-3 bg-[#e8e4d9] border-2 border-[#b5a695] rounded-xl text-[#3e362e] shadow-inner font-medium break-words">
                  <ScrumTooltip keyword="PO" text="PO" />、
                  <ScrumTooltip keyword="SM" text="SM" />、
                  <ScrumTooltip keyword="DEVS" text="DEVS" />、<input type="text" value={data.stakeholders} onChange={e => updateData({ stakeholders: e.target.value })} className="bg-transparent border-b-2 border-[#b5a695] focus:border-[#8fb996] outline-none ml-1 placeholder-[#8a7f72]" placeholder="其他參與者" />
                </div>`;

const newUI = `<div className="px-4 py-3 bg-[#e8e4d9] border-2 border-[#b5a695] rounded-xl text-[#3e362e] shadow-inner font-medium break-words flex flex-wrap gap-2 items-center">
                  <div className="flex items-center gap-1"><ScrumTooltip keyword="PO" text="Product Owner" />:<input type="text" value={data.po || ''} onChange={e => updateData({ po: e.target.value })} className="w-20 bg-transparent border-b-2 border-[#b5a695] focus:border-[#8fb996] outline-none ml-1 placeholder-[#8a7f72]" placeholder="PO姓名" /></div>
                  <div className="flex items-center gap-1"><ScrumTooltip keyword="SM" text="Scrum Master" />:<input type="text" value={data.sm || ''} onChange={e => updateData({ sm: e.target.value })} className="w-20 bg-transparent border-b-2 border-[#b5a695] focus:border-[#8fb996] outline-none ml-1 placeholder-[#8a7f72]" placeholder="SM姓名" /></div>
                  <div className="flex items-center gap-1"><ScrumTooltip keyword="DEVS" text="開發團隊" />:<input type="text" value={data.devs || ''} onChange={e => updateData({ devs: e.target.value })} className="w-32 bg-transparent border-b-2 border-[#b5a695] focus:border-[#8fb996] outline-none ml-1 placeholder-[#8a7f72]" placeholder="DEVS名單" /></div>
                  <div className="flex items-center gap-1">其他:<input type="text" value={data.stakeholders} onChange={e => updateData({ stakeholders: e.target.value })} className="w-32 bg-transparent border-b-2 border-[#b5a695] focus:border-[#8fb996] outline-none ml-1 placeholder-[#8a7f72]" placeholder="利益關係人、專家" /></div>
                </div>`;

content = content.replace(oldUI, newUI);
fs.writeFileSync(path, content);
console.log('patched roles');