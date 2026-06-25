const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/planning/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldGrid = `<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex flex-col gap-2">
                <label className="font-bold text-[#6b5e50]">目的</label>
                <div className="px-4 py-3 bg-[#e8e4d9] border-2 border-[#b5a695] rounded-xl text-[#3e362e] shadow-inner font-medium">
                  建立共識並敲定行動計畫
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="font-bold text-[#6b5e50]">時間限制 (TIME)</label>
                <select className="px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner font-medium text-[#3e362e]" value={data.timeLimit} onChange={e => updateData({ timeLimit: e.target.value })}> 
                  <option value="1">1 週 (≤ 2 小時)</option>
                  <option value="2">2 週 (≤ 4 小時)</option>
                  <option value="3">3 週 (≤ 6 小時)</option>
                  <option value="4">4 週 (≤ 8 小時)</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-bold text-[#6b5e50]">開始日</label>
                <input type="date" value={data.startDate} onChange={e => updateData({ startDate: e.target.value })} className="px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner font-medium text-[#3e362e]" />
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-bold text-[#6b5e50]">與會人</label>
                <div className="px-4 py-3 bg-[#e8e4d9] border-2 border-[#b5a695] rounded-xl text-[#3e362e] shadow-inner font-medium">
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
                </div>
              </div>
            </div>`;

const newGrid = `<div className="flex flex-col lg:flex-row gap-6">
              {/* 左側 3 個欄位 */}
              <div className="flex-1 flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-[#6b5e50]">目的</label>
                  <div className="px-4 py-3 bg-[#e8e4d9] border-2 border-[#b5a695] rounded-xl text-[#3e362e] shadow-inner font-medium">
                    建立共識並敲定行動計畫
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-[#6b5e50]">時間限制 (TIME)</label>
                  <select className="px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner font-medium text-[#3e362e]" value={data.timeLimit} onChange={e => updateData({ timeLimit: e.target.value })}> 
                    <option value="1">1 週 (≤ 2 小時)</option>
                    <option value="2">2 週 (≤ 4 小時)</option>
                    <option value="3">3 週 (≤ 6 小時)</option>
                    <option value="4">4 週 (≤ 8 小時)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-bold text-[#6b5e50]">開始日</label>
                  <input type="date" value={data.startDate} onChange={e => updateData({ startDate: e.target.value })} className="px-4 py-3 bg-[#fffdf9] border-2 border-[#b5a695] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 shadow-inner font-medium text-[#3e362e]" />
                </div>
              </div>

              {/* 右側：與會人 */}
              <div className="flex-1 flex flex-col gap-2">
                <label className="font-bold text-[#6b5e50]">與會人</label>
                <div className="px-4 py-3 bg-[#e8e4d9] border-2 border-[#b5a695] rounded-xl text-[#3e362e] shadow-inner font-medium flex-1">
                  <div className="flex flex-col gap-4 justify-around h-full">
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
                </div>
              </div>
            </div>`;

content = content.replace(oldGrid, newGrid);
fs.writeFileSync(path, content);
console.log('patched planning layout');