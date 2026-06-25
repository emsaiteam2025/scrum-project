const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. 擴充 Backlog 的 data state 增加 devsList 欄位
content = content.replace(
  `sprintGoal: '',\n    stakeholders: ''\n  });`,
  `sprintGoal: '',\n    stakeholders: '',\n    devsList: [] as string[]\n  });`
);

// 2. 在同步 planning 的時候，順便把 devs 同步進來並切成 array
const syncTargetOld = `if (planningData && planningData.whats) {`;
const syncTargetNew = `if (planningData) {
          if (planningData.devs) {
            const devsArray = planningData.devs.split(/[,、，]/).map((d: string) => d.trim()).filter((d: string) => d);
            updateData({ devsList: devsArray });
          }

          if (planningData.whats) {`;

content = content.replace(syncTargetOld, syncTargetNew);

// 3. 把 input 負責人欄位 改成包含 select / datalist 或是 dropdown 的設計
const inputOld = `<input 
                    type="text" 
                    value={task.role || ''} 
                    onChange={(e) => updateTask(task.id, 'role', e.target.value)}
                    className="w-1/2 text-xs p-2 border-2 border-[#b5a695] rounded focus:outline-none focus:border-[#5b755e]"
                    placeholder="負責人"
                  />`;

const inputNew = `<div className="w-1/2 relative flex items-center">
                    <input 
                      type="text" 
                      list={\`devs-list-\${task.id}\`}
                      value={task.role || ''} 
                      onChange={(e) => updateTask(task.id, 'role', e.target.value)}
                      className="w-full text-xs p-2 border-2 border-[#b5a695] rounded focus:outline-none focus:border-[#5b755e]"
                      placeholder="負責人"
                    />
                    <datalist id={\`devs-list-\${task.id}\`}>
                      {data.devsList && data.devsList.map((dev: string) => (
                        <option key={dev} value={dev} />
                      ))}
                    </datalist>
                  </div>`;

// 替換兩個編輯畫面裡的負責人欄位 (任務本身 跟 PBI底下泳道的編輯畫面)
content = content.replace(inputOld, inputNew);
content = content.replace(inputOld, inputNew); // 替換第二個

fs.writeFileSync(path, content);
console.log('patched devs dropdown');