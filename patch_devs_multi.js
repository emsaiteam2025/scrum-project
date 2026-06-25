const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldUI = `<div className="flex gap-2">
                  <div className="w-1/2 relative flex items-center">
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
                  </div>
                  <input 
                    type="text" 
                    value={task.time || ''} 
                    onChange={(e) => updateTask(task.id, 'time', e.target.value)}
                    className="w-1/2 text-xs p-2 border-2 border-[#b5a695] rounded focus:outline-none focus:border-[#5b755e]"
                    placeholder="預估工時 (例: 4h)"
                  />
                </div>`;

const newUI = `<div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={task.role || ''} 
                      onChange={(e) => updateTask(task.id, 'role', e.target.value)}
                      className="w-1/2 text-xs p-2 border-2 border-[#b5a695] rounded focus:outline-none focus:border-[#5b755e]"
                      placeholder="負責人 (可多選)"
                    />
                    <input 
                      type="text" 
                      value={task.time || ''} 
                      onChange={(e) => updateTask(task.id, 'time', e.target.value)}
                      className="w-1/2 text-xs p-2 border-2 border-[#b5a695] rounded focus:outline-none focus:border-[#5b755e]"
                      placeholder="預估工時 (例: 4h)"
                    />
                  </div>
                  {data.devsList && data.devsList.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {data.devsList.map((dev: string) => {
                        const currentRoles = (task.role || '').split(',').map((r: string) => r.trim()).filter((r: string) => r);
                        const isSelected = currentRoles.includes(dev);
                        return (
                          <button
                            key={dev}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                updateTask(task.id, 'role', currentRoles.filter((r: string) => r !== dev).join(', '));
                              } else {
                                updateTask(task.id, 'role', [...currentRoles, dev].join(', '));
                              }
                            }}
                            className={\`text-[10px] font-bold px-2 py-1 rounded-md border transition-colors \${
                              isSelected 
                                ? 'bg-[#5b755e] text-white border-[#5b755e]' 
                                : 'bg-[#e8eedd] text-[#5b755e] border-[#a5c2a8] hover:bg-[#d5dfca]'
                            }\`}
                          >
                            {dev} {isSelected ? '✓' : '+'}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>`;

content = content.replaceAll(oldUI, newUI);
fs.writeFileSync(path, content);
console.log('patched multiple devs selection');