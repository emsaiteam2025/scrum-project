const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldSwimlaneTodo = `                       <div className="flex-1 p-2 border-r-4 border-[#5b755e] bg-[#fceded]/10" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'todo', undefined, pbi.id)}>
                         <div className="flex flex-col gap-2 h-full">
                           {renderTasks('todo', pbi.id)}
                         </div>
                       </div>`;

const newSwimlaneTodo = `                       <div className="flex-1 p-2 border-r-4 border-[#5b755e] bg-[#fceded]/10 flex flex-col" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'todo', undefined, pbi.id)}>
                         <div className="flex justify-end mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => {
                               const newId = \`task-\${Date.now()}\`;
                               // 加入新任務時自動帶入該行對應的 pbiId
                               setTasks((prev) => [{ id: newId, type: 'task', status: 'todo', title: '', desc: '', role: '', time: '', pbiId: pbi.id }, ...prev]);
                               setEditingTaskId(newId);
                            }} className="text-xs font-bold bg-white border border-[#e6b1b1] text-[#c96262] px-2 py-1 rounded hover:bg-[#c96262] hover:text-white transition-colors shadow-sm">➕ 建立對齊此PBI的任務</button>
                         </div>
                         <div className="flex flex-col gap-2 flex-1">
                           {renderTasks('todo', pbi.id)}
                         </div>
                       </div>`;

content = content.replace(oldSwimlaneTodo, newSwimlaneTodo);

fs.writeFileSync(path, content);
console.log("Swimlane add task button applied!");