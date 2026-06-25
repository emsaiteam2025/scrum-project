const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/daily-scrum/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update initial data schema
const oldSchema = `  const { data, updateData, loading } = useAutoSave('daily', {
    completedDays: [] as boolean[],
    dailyNotes: {} as Record<number, string>
  });`;
const newSchema = `  const { data, updateData, loading } = useAutoSave('daily', {
    completedDays: [] as boolean[],
    dailyNotes: {} as Record<number, string>,
    dailyNotesQ1: {} as Record<number, string>,
    dailyNotesQ2: {} as Record<number, string>,
    dailyNotesQ3: {} as Record<number, string>
  });`;
content = content.replace(oldSchema, newSchema);

// 2. Update destructuring
const oldDestruct = `  const completedDays = data.completedDays;
  const dailyNotes = data.dailyNotes || {};`;
const newDestruct = `  const completedDays = data.completedDays;
  const dailyNotes = data.dailyNotes || {};
  const dailyNotesQ1 = data.dailyNotesQ1 || {};
  const dailyNotesQ2 = data.dailyNotesQ2 || {};
  const dailyNotesQ3 = data.dailyNotesQ3 || {};`;
content = content.replace(oldDestruct, newDestruct);

// 3. Update updateNote function
const oldUpdate = `  const updateNote = (index: number, text: string) => {
    updateData({ dailyNotes: { ...dailyNotes, [index]: text } });
  };`;
const newUpdate = `  const updateSpecificNote = (index: number, key: 'Q1' | 'Q2' | 'Q3', text: string) => {
    if (key === 'Q1') {
      updateData({ dailyNotesQ1: { ...dailyNotesQ1, [index]: text } });
    } else if (key === 'Q2') {
      updateData({ dailyNotesQ2: { ...dailyNotesQ2, [index]: text } });
    } else if (key === 'Q3') {
      updateData({ dailyNotesQ3: { ...dailyNotesQ3, [index]: text } });
    }
  };`;
content = content.replace(oldUpdate, newUpdate);

// 4. Update UI part
const oldUI = `                      <textarea
                        value={dailyNotes[i] || ''}
                        onChange={(e) => updateNote(i, e.target.value)}
                        placeholder="請記錄：&#10;1. 昨天完成了什麼？&#10;2. 今天預計要做什麼？&#10;3. 目前有沒有遇到任何阻礙？"
                        className="w-full h-40 p-4 border-2 border-[#a5c2a8] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 bg-white text-[#3e362e] resize-none shadow-inner"
                      />`;
const newUI = `                      <div className="flex flex-col gap-4">
                        {dailyNotes[i] && !dailyNotesQ1[i] && !dailyNotesQ2[i] && !dailyNotesQ3[i] && (
                          <div className="bg-[#fffdf9] p-3 border-2 border-dashed border-[#d4a373] rounded-lg text-sm text-[#8b5a2b] whitespace-pre-wrap">
                            <strong>舊版紀錄保留：</strong>\\n{dailyNotes[i]}
                          </div>
                        )}
                        <div className="flex flex-col gap-2">
                          <label className="font-bold text-[#5b755e] flex items-center gap-2"><span>🔄</span> 1. 昨天完成了什麼？</label>
                          <textarea
                            value={dailyNotesQ1[i] || ''}
                            onChange={(e) => updateSpecificNote(i, 'Q1', e.target.value)}
                            placeholder="記錄昨日的進展..."
                            className="w-full h-24 p-3 border-2 border-[#a5c2a8] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 bg-white text-[#3e362e] resize-none shadow-inner"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="font-bold text-[#5b755e] flex items-center gap-2"><span>🎯</span> 2. 今天預計要做什麼？</label>
                          <textarea
                            value={dailyNotesQ2[i] || ''}
                            onChange={(e) => updateSpecificNote(i, 'Q2', e.target.value)}
                            placeholder="規劃今日的目標..."
                            className="w-full h-24 p-3 border-2 border-[#a5c2a8] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#8fb996]/50 bg-white text-[#3e362e] resize-none shadow-inner"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="font-bold text-[#c96262] flex items-center gap-2"><span>🚧</span> 3. 目前有沒有遇到任何阻礙？</label>
                          <textarea
                            value={dailyNotesQ3[i] || ''}
                            onChange={(e) => updateSpecificNote(i, 'Q3', e.target.value)}
                            placeholder="提出需要協助或排除的阻礙..."
                            className="w-full h-24 p-3 border-2 border-[#e6b1b1] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#e6b1b1]/50 bg-white text-[#3e362e] resize-none shadow-inner"
                          />
                        </div>
                      </div>`;
content = content.replace(oldUI, newUI);

fs.writeFileSync(path, content);
console.log('patched daily scrum textareas');