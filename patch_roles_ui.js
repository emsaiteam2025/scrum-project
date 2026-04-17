const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/planning/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const badUI = `<div className="px-4 py-3 bg-[#e8e4d9] border-2 border-[#b5a695] rounded-xl text-[#3e362e] shadow-inner font-medium break-words flex flex-wrap gap-2 items-center">
                  <div className="flex items-center gap-1"><ScrumTooltip keyword="PO" text="Product Owner" />:<input type="text" value={data.po || ''} onChange={e => updateData({ po: e.target.value })} className="w-20 bg-transparent border-b-2 border-[#b5a695] focus:border-[#8fb996] outline-none ml-1 placeholder-[#8a7f72]" placeholder="PO姓名" /></div>
                  <div className="flex items-center gap-1"><ScrumTooltip keyword="SM" text="Scrum Master" />:<input type="text" value={data.sm || ''} onChange={e => updateData({ sm: e.target.value })} className="w-20 bg-transparent border-b-2 border-[#b5a695] focus:border-[#8fb996] outline-none ml-1 placeholder-[#8a7f72]" placeholder="SM姓名" /></div>
                  <div className="flex items-center gap-1"><ScrumTooltip keyword="DEVS" text="開發團隊" />:<input type="text" value={data.devs || ''} onChange={e => updateData({ devs: e.target.value })} className="w-32 bg-transparent border-b-2 border-[#b5a695] focus:border-[#8fb996] outline-none ml-1 placeholder-[#8a7f72]" placeholder="DEVS名單" /></div>
                  <div className="flex items-center gap-1">其他:<input type="text" value={data.stakeholders} onChange={e => updateData({ stakeholders: e.target.value })} className="w-32 bg-transparent border-b-2 border-[#b5a695] focus:border-[#8fb996] outline-none ml-1 placeholder-[#8a7f72]" placeholder="利益關係人、專家" /></div>
                </div>`;

const newUI = `<div className="px-4 py-3 bg-[#e8e4d9] border-2 border-[#b5a695] rounded-xl text-[#3e362e] shadow-inner font-medium">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-32 flex-shrink-0"><ScrumTooltip keyword="PO" text="Product Owner" /></div>
                      <span>:</span>
                      <input type="text" value={data.po || ''} onChange={e => updateData({ po: e.target.value })} className="flex-1 min-w-0 bg-transparent border-b-2 border-[#b5a695] focus:border-[#8fb996] outline-none placeholder-[#8a7f72]" placeholder="PO姓名" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-32 flex-shrink-0"><ScrumTooltip keyword="SM" text="Scrum Master" /></div>
                      <span>:</span>
                      <input type="text" value={data.sm || ''} onChange={e => updateData({ sm: e.target.value })} className="flex-1 min-w-0 bg-transparent border-b-2 border-[#b5a695] focus:border-[#8fb996] outline-none placeholder-[#8a7f72]" placeholder="SM姓名" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-32 flex-shrink-0"><ScrumTooltip keyword="DEVS" text="開發團隊" /></div>
                      <span>:</span>
                      <input type="text" value={data.devs || ''} onChange={e => updateData({ devs: e.target.value })} className="flex-1 min-w-0 bg-transparent border-b-2 border-[#b5a695] focus:border-[#8fb996] outline-none placeholder-[#8a7f72]" placeholder="DEVS名單" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-32 flex-shrink-0 pl-1">其他</div>
                      <span>:</span>
                      <input type="text" value={data.stakeholders} onChange={e => updateData({ stakeholders: e.target.value })} className="flex-1 min-w-0 bg-transparent border-b-2 border-[#b5a695] focus:border-[#8fb996] outline-none placeholder-[#8a7f72]" placeholder="利益關係人、專家" />
                    </div>
                  </div>
                </div>`;

content = content.replace(badUI, newUI);
fs.writeFileSync(path, content);
console.log('patched roles ui');
