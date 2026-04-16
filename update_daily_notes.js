const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/daily-scrum/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `completedDays: [] as boolean[]`,
  `completedDays: [] as boolean[],\n    dailyNotes: {} as Record<number, string>`
);

content = content.replace(
  `const completedDays = data.completedDays;`,
  `const completedDays = data.completedDays;\n  const dailyNotes = data.dailyNotes || {};\n  const [activeDay, setActiveDay] = useState<number | null>(null);`
);

content = content.replace(
  `  const toggleDay = (index: number) => {
    const newDays = [...completedDays];
    newDays[index] = !newDays[index];
    updateData({ completedDays: newDays });
  };`,
  `  const updateNote = (index: number, text: string) => {
    updateData({ dailyNotes: { ...dailyNotes, [index]: text } });
  };

  const toggleDay = (index: number) => {
    setActiveDay(index === activeDay ? null : index);
  };
  
  const toggleCheck = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const newDays = [...completedDays];
    newDays[index] = !newDays[index];
    updateData({ completedDays: newDays });
  };`
);

const cardContent = `
                  <div key={i} className={\`transition-all duration-300 \${activeDay === i ? 'col-span-full' : ''}\`}>
                  <div 
                    onClick={() => toggleDay(i)}
                    className={\`border-4 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group relative overflow-hidden min-h-[120px]
                      \${isChecked 
                        ? 'bg-[#8fb996] border-[#5b755e] shadow-md' 
                        : 'bg-[#e8eedd] border-[#a5c2a8] hover:bg-[#dcedc1] hover:-translate-y-1 hover:shadow-md'
                      }
                      \${activeDay === i ? 'ring-4 ring-[#e07a5f] scale-[1.02]' : ''}
                      \`}
                  >
                    <div className={\`absolute top-3 right-3 flex items-center justify-center w-6 h-6 rounded border-2 \${isChecked ? 'bg-white border-white text-[#5b755e]' : 'border-[#8a7f72] bg-white'}\`} onClick={(e) => toggleCheck(e, i)}>
                      {isChecked && '✓'}
                    </div>
                    <div className={\`font-bold text-lg z-10 transition-transform \${isChecked ? 'text-white' : 'text-[#4a7c59] group-hover:scale-110'}\`}>
                      Day {i + 1}
                    </div>
                    <div className={\`text-3xl mt-2 z-10 transition-all \${isChecked ? 'opacity-100 scale-125' : 'opacity-50 group-hover:opacity-100'}\`}>
                      {isChecked ? '✅' : '🌱'}
                    </div>
                    
                    {/* 點擊時的波紋效果背景 */}
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                    
                    {/* 打勾狀態的裝飾 */}
                    {isChecked && (
                      <div className="absolute -top-2 -right-2 text-2xl opacity-30 animate-pulse">
                        ✨
                      </div>
                    )}
                  </div>
                  
                  {/* 展開的筆記區塊 */}
                  {activeDay === i && (
                    <div className="mt-4 bg-[#f9fcf8] border-4 border-[#8fb996] rounded-2xl p-6 shadow-lg relative ml-2 mr-2">
                      <h3 className="text-[#5b755e] font-bold text-xl mb-4 flex items-center gap-2">
                        <span>📝</span> Day {i + 1} 執行事項與阻礙紀錄
                      </h3>
                      <textarea
                        value={dailyNotes[i] || ''}
                        onChange={(e) => updateNote(i, e.target.value)}
                        placeholder="請記錄：&#10;1. 昨天完成了什麼？&#10;2. 今天預計要做什麼？&#10;3. 目前有沒有遇到任何阻礙？"
                        className="w-full h-40 p-4 border-2 border-[#a5c2a8] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 bg-white text-[#3e362e] resize-none shadow-inner"
                      />
                      <div className="flex justify-end mt-4">
                         <button 
                           onClick={() => toggleDay(i)}
                           className="bg-[#e8eedd] text-[#5b755e] border-2 border-[#8fb996] px-6 py-2 rounded-xl font-bold hover:bg-[#dcedc1] transition-all shadow-sm"
                         >
                           收起紀錄
                         </button>
                      </div>
                    </div>
                  )}
                  </div>
`;

content = content.replace(
  /<div \n                    key=\{i\} \n                    onClick=\{\(\) => toggleDay\(i\)\}[\s\S]*?✨\n                      <\/div>\n                    \)}\n                  <\/div>/m,
  cardContent
);

fs.writeFileSync(path, content);
console.log('done');
