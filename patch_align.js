const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldKanban = `<div className="flex-1 flex bg-[#f4f1ea]/50 overflow-x-auto relative">
            
            {/* Left Fixed Column: PBI */}
            <div 
              className="flex-shrink-0 w-64 md:w-72 flex flex-col border-r-4 border-[#5b755e] bg-[#fffdf9] z-10 sticky left-0 shadow-[4px_0_15px_-3px_rgba(0,0,0,0.1)]"
            >
              <div className="bg-[#e8e4d9] border-b-4 border-[#5b755e] p-3 font-bold text-center text-[#5b755e] tracking-wider"><ScrumTooltip keyword="Product Backlog" text="排序的 PBI (1-5)" /></div>
              <div className="p-4 space-y-4 flex-1 overflow-y-auto" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'pbi')}>
                {renderTasks('pbi')}
              </div>
            </div>

            {/* Right Scrollable Columns: Todo, Doing, Done, Accepted */}
            <div className="flex-1 flex flex-col min-w-[800px]">
               {/* Header Row */}
               <div className="flex border-b-4 border-[#5b755e]">
                 <div className="flex-1 bg-[#fceded] border-r-4 border-[#5b755e] p-3 font-bold text-center text-[#c96262] tracking-wider">TO DO (待處理)</div>
                 <div className="flex-1 bg-[#faebce] border-r-4 border-[#5b755e] p-3 font-bold text-center text-[#d4a373] tracking-wider">Doing (進行中)</div>
                 <div className="flex-1 bg-[#e8eedd] border-r-4 border-[#5b755e] p-3 font-bold text-center text-[#4a7c59] tracking-wider">Done (已完成)</div>
                 <div className="flex-1 bg-[#eac4d0] p-3 font-bold text-center text-[#9b596f] tracking-wider"><ScrumTooltip keyword="Increment" text="驗收的 PBI (增量)" /></div>
               </div>
               
               {/* Swimlanes for each PBI */}
               <div className="flex-1 overflow-y-auto flex flex-col">
                 {/* For each PBI, render a row */}
                 {tasks.filter(t => t.status === 'pbi').map((pbi) => (
                    <div key={pbi.id} className="flex border-b-4 border-dashed border-[#b5a695]/30 min-h-[250px] group relative">
                       {/* Background hint for swimlane */}
                       <div className="absolute inset-0 pointer-events-none border-l-8 border-[#d4a373]/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                       
                       <div className="flex-1 p-2 border-r-4 border-[#5b755e] bg-[#fceded]/10 flex flex-col" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'todo', undefined, pbi.id)}>
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
                       </div>
                       
                       <div className="flex-1 p-2 border-r-4 border-[#5b755e] bg-[#faebce]/10" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'doing', undefined, pbi.id)}>
                         <div className="flex flex-col gap-2 h-full">
                           {renderTasks('doing', pbi.id)}
                         </div>
                       </div>
                       
                       <div className="flex-1 p-2 border-r-4 border-[#5b755e] bg-[#e8eedd]/10" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'done', undefined, pbi.id)}>
                         <div className="flex flex-col gap-2 h-full">
                           {renderTasks('done', pbi.id)}
                         </div>
                       </div>
                       
                       <div className="flex-1 p-2 bg-[#eac4d0]/10 flex items-center justify-center">
                         {/* 驗收區塊通常是整張 PBI 拉過來，所以這個格子我們只放個視覺提示 */}
                         <div className="text-[#9b596f]/30 font-bold text-sm transform -rotate-12">對應 PBI 增量</div>
                       </div>
                    </div>
                 ))}
                 
                 {/* Unassigned Tasks Row (如果有的話) */}
                 <div className="flex min-h-[250px] bg-white/30">
                       <div className="flex-1 p-2 border-r-4 border-[#5b755e] bg-[#fceded]/30" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'todo', undefined, 'unassigned')}>
                         <div className="text-xs font-bold text-[#c96262]/50 mb-2 px-2">無歸屬任務區</div>
                         <div className="flex flex-col gap-2 h-full">
                           {renderTasks('todo', 'unassigned')}
                         </div>
                       </div>
                       
                       <div className="flex-1 p-2 border-r-4 border-[#5b755e] bg-[#faebce]/30" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'doing', undefined, 'unassigned')}>
                         <div className="text-xs font-bold text-[#d4a373]/50 mb-2 px-2">無歸屬任務區</div>
                         <div className="flex flex-col gap-2 h-full">
                           {renderTasks('doing', 'unassigned')}
                         </div>
                       </div>
                       
                       <div className="flex-1 p-2 border-r-4 border-[#5b755e] bg-[#e8eedd]/30" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'done', undefined, 'unassigned')}>
                         <div className="text-xs font-bold text-[#4a7c59]/50 mb-2 px-2">無歸屬任務區</div>
                         <div className="flex flex-col gap-2 h-full">
                           {renderTasks('done', 'unassigned')}
                         </div>
                       </div>
                       
                       <div className="flex-1 p-2 bg-[#eac4d0]/30 flex items-center justify-center">
                       </div>
                 </div>
               </div>
            </div>
          </div>`;

const newKanban = `<div className="flex-1 flex flex-col bg-[#f4f1ea]/50 overflow-x-auto relative">
             {/* Header Row (Combined) */}
             <div className="flex border-b-4 border-[#5b755e] min-w-[1050px]">
               <div className="w-64 md:w-72 flex-shrink-0 bg-[#e8e4d9] border-r-4 border-[#5b755e] p-3 font-bold text-center text-[#5b755e] tracking-wider sticky left-0 z-20 shadow-[4px_0_15px_-3px_rgba(0,0,0,0.1)]">
                 <ScrumTooltip keyword="Product Backlog" text="排序的 PBI (1-5)" />
               </div>
               <div className="flex-1 bg-[#fceded] border-r-4 border-[#5b755e] p-3 font-bold text-center text-[#c96262] tracking-wider min-w-[200px]">TO DO (待處理)</div>
               <div className="flex-1 bg-[#faebce] border-r-4 border-[#5b755e] p-3 font-bold text-center text-[#d4a373] tracking-wider min-w-[200px]">Doing (進行中)</div>
               <div className="flex-1 bg-[#e8eedd] border-r-4 border-[#5b755e] p-3 font-bold text-center text-[#4a7c59] tracking-wider min-w-[200px]">Done (已完成)</div>
               <div className="flex-1 bg-[#eac4d0] p-3 font-bold text-center text-[#9b596f] tracking-wider min-w-[200px]"><ScrumTooltip keyword="Increment" text="驗收的 PBI (增量)" /></div>
             </div>

             {/* Swimlanes */}
             <div className="flex-1 overflow-y-auto flex flex-col min-w-[1050px]">
               {tasks.filter(t => t.status === 'pbi').map((pbi) => {
                  return (
                  <div key={pbi.id} className="flex border-b-4 border-dashed border-[#b5a695]/30 min-h-[250px] group relative">
                     {/* Background hint for swimlane */}
                     <div className="absolute inset-0 pointer-events-none border-l-8 border-[#d4a373]/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                     
                     {/* PBI Cell (Sticky Left) */}
                     <div className="w-64 md:w-72 flex-shrink-0 p-4 border-r-4 border-[#5b755e] bg-[#fffdf9] sticky left-0 z-10 shadow-[4px_0_15px_-3px_rgba(0,0,0,0.1)]" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'pbi', undefined, pbi.id)}>
                        {tasks.filter(t => t.id === pbi.id).map(task => {
                            const isEditing = editingTaskId === task.id;
                            return (
                                <div 
                                  key={task.id}
                                  draggable={!isEditing}
                                  onDragStart={(e) => onDragStart(e, task)}
                                  onDragOver={onDragOver}
                                  onDrop={(e) => {
                                    e.stopPropagation();
                                    onDrop(e, 'pbi', task.id, undefined);
                                  }}
                                  className={\`bg-[#fffdf9] border-2 p-4 rounded-xl shadow-sm transition-all group/task relative
                                    \${task.type === 'pbi' ? 'border-[#d4a373] bg-[#f2e3c6] hover:bg-[#faebce]' : 'border-[#b5a695] hover:border-[#c96262]'}
                                    \${task.status === 'doing' ? 'border-l-8 border-l-[#d4a373]' : ''}
                                    \${!isEditing ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : 'shadow-md'}
                                  \`}
                                >
                                  {/* Header */}
                                  <div className="flex justify-between items-start mb-3">
                                    <span className={\`text-[10px] font-bold px-2 py-1 rounded-md border text-[#8b5a2b] bg-[#faebce] border-[#d4a373]\`}>
                                      PBI
                                    </span>
                                    
                                    {!isEditing && (
                                      <div className="opacity-0 group-hover/task:opacity-100 transition-opacity flex gap-1 absolute top-2 right-2 bg-white/80 p-1 rounded-lg shadow-sm z-10">
                                        <button onClick={() => moveTask(task.id, -1)} className="text-gray-500 hover:text-gray-700 bg-gray-50 p-1.5 rounded-md text-xs font-bold" title="向上排序">🔼</button>
                                        <button onClick={() => moveTask(task.id, 1)} className="text-gray-500 hover:text-gray-700 bg-gray-50 p-1.5 rounded-md text-xs font-bold" title="向下排序">🔽</button>
                                        <button onClick={() => setEditingTaskId(task.id)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded-md" title="編輯">✏️</button>
                                        <button onClick={() => deleteTask(task.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-md" title="刪除">🗑️</button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Body */}
                                  {isEditing ? (
                                    <div className="space-y-2 mt-2">
                                      <input 
                                        type="text" 
                                        value={task.title} 
                                        onChange={(e) => updateTask(task.id, 'title', e.target.value)}
                                        className="w-full text-sm font-bold p-2 border-2 border-[#b5a695] rounded focus:outline-none focus:border-[#5b755e]"
                                        placeholder="PBI 標題"
                                      />
                                      <textarea 
                                        value={task.desc || ''} 
                                        onChange={(e) => updateTask(task.id, 'desc', e.target.value)}
                                        className="w-full text-xs p-2 border-2 border-[#b5a695] rounded focus:outline-none focus:border-[#5b755e]"
                                        placeholder="PBI 描述說明 (選填)"
                                        rows={3}
                                      />
                                      <div className="flex justify-end gap-2 mt-2">
                                        <button onClick={() => setEditingTaskId(null)} className="text-xs font-bold bg-[#5b755e] text-white px-3 py-1 rounded hover:bg-[#4a614d] transition-colors">完成</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <h4 className="text-sm font-bold text-[#3e362e] mb-1">{task.title || '(未命名項目)'}</h4>
                                      {task.desc && <p className="text-xs text-[#6b5e50] line-clamp-3 mb-2 whitespace-pre-wrap">{task.desc}</p>}
                                    </>
                                  )}
                                </div>
                            );
                        })}
                     </div>

                     <div className="flex-1 p-2 border-r-4 border-[#5b755e] bg-[#fceded]/10 flex flex-col min-w-[200px]" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'todo', undefined, pbi.id)}>
                       <div className="flex justify-end mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => {
                             const newId = \`task-\${Date.now()}\`;
                             setTasks((prev) => [{ id: newId, type: 'task', status: 'todo', title: '', desc: '', role: '', time: '', pbiId: pbi.id }, ...prev]);
                             setEditingTaskId(newId);
                          }} className="text-xs font-bold bg-white border border-[#e6b1b1] text-[#c96262] px-2 py-1 rounded hover:bg-[#c96262] hover:text-white transition-colors shadow-sm">➕ 建立對齊此PBI的任務</button>
                       </div>
                       <div className="flex flex-col gap-2 flex-1">
                         {renderTasks('todo', pbi.id)}
                       </div>
                     </div>
                     
                     <div className="flex-1 p-2 border-r-4 border-[#5b755e] bg-[#faebce]/10 min-w-[200px]" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'doing', undefined, pbi.id)}>
                       <div className="flex flex-col gap-2 h-full">
                         {renderTasks('doing', pbi.id)}
                       </div>
                     </div>
                     
                     <div className="flex-1 p-2 border-r-4 border-[#5b755e] bg-[#e8eedd]/10 min-w-[200px]" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'done', undefined, pbi.id)}>
                       <div className="flex flex-col gap-2 h-full">
                         {renderTasks('done', pbi.id)}
                       </div>
                     </div>
                     
                     <div className="flex-1 p-2 bg-[#eac4d0]/10 flex items-center justify-center min-w-[200px]">
                       <div className="text-[#9b596f]/30 font-bold text-sm transform -rotate-12">對應 PBI 增量</div>
                     </div>
                  </div>
                  );
               })}
               
               {/* Unassigned Tasks Row (如果有的話) */}
               <div className="flex min-h-[250px] bg-white/30">
                     {/* PBI Cell (Empty for Unassigned) */}
                     <div className="w-64 md:w-72 flex-shrink-0 p-4 border-r-4 border-[#5b755e] bg-[#fffdf9] sticky left-0 z-10 shadow-[4px_0_15px_-3px_rgba(0,0,0,0.1)]">
                         <div className="flex items-center justify-center h-full text-[#b5a695]/50 text-xs font-bold border-2 border-dashed border-[#b5a695]/30 rounded-xl m-2">
                             <span>無歸屬任務區</span>
                         </div>
                     </div>

                     <div className="flex-1 p-2 border-r-4 border-[#5b755e] bg-[#fceded]/30 min-w-[200px]" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'todo', undefined, 'unassigned')}>
                       <div className="text-xs font-bold text-[#c96262]/50 mb-2 px-2">無歸屬任務區</div>
                       <div className="flex flex-col gap-2 h-full">
                         {renderTasks('todo', 'unassigned')}
                       </div>
                     </div>
                     
                     <div className="flex-1 p-2 border-r-4 border-[#5b755e] bg-[#faebce]/30 min-w-[200px]" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'doing', undefined, 'unassigned')}>
                       <div className="text-xs font-bold text-[#d4a373]/50 mb-2 px-2">無歸屬任務區</div>
                       <div className="flex flex-col gap-2 h-full">
                         {renderTasks('doing', 'unassigned')}
                       </div>
                     </div>
                     
                     <div className="flex-1 p-2 border-r-4 border-[#5b755e] bg-[#e8eedd]/30 min-w-[200px]" onDragOver={onDragOver} onDrop={(e) => onDrop(e, 'done', undefined, 'unassigned')}>
                       <div className="text-xs font-bold text-[#4a7c59]/50 mb-2 px-2">無歸屬任務區</div>
                       <div className="flex flex-col gap-2 h-full">
                         {renderTasks('done', 'unassigned')}
                       </div>
                     </div>
                     
                     <div className="flex-1 p-2 bg-[#eac4d0]/30 flex items-center justify-center min-w-[200px]">
                     </div>
               </div>
             </div>
          </div>`;

content = content.replace(oldKanban, newKanban);

fs.writeFileSync(path, content);
console.log("Kanban align patch applied!");