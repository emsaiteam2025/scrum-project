const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldDevsSync = `if (planningData) {
          if (planningData.devs) {
            const devsArray = planningData.devs.split(/[,、，]/).map((d: string) => d.trim()).filter((d: string) => d);
            updateData({ devsList: devsArray });
          }`;

const newDevsSync = `if (planningData) {
          if (planningData.devs) {
            const devsArray = planningData.devs.split(/[,、，\\n]/).map((d: string) => d.trim()).filter((d: string) => d);
            // 避免 Viewer 觸發 updateData 導致報錯
            if (!isPublicViewer || auth.currentUser) {
               updateData({ devsList: devsArray });
            }
          }`;

content = content.replace(oldDevsSync, newDevsSync);

const oldTasksSync = `          const whats = planningData.whats.filter((w: {id: string, text: string}) => w.text && w.text.trim() !== '');
          
          setTasks(prev => {`;

const newTasksSync = `          const whats = planningData.whats.filter((w: {id: string, text: string}) => w.text && w.text.trim() !== '');
          
          if (!isPublicViewer || auth.currentUser) {
          setTasks(prev => {`;

const oldTasksEnd = `            if (prevHash !== mergedHash) {
               return mergedTasks;
            }
            
            return prev;
          });
        } // end of if (planningData.whats)`;

const newTasksEnd = `            if (prevHash !== mergedHash) {
               return mergedTasks;
            }
            
            return prev;
          });
          } // end of !isPublicViewer
        } // end of if (planningData.whats)`;

content = content.replace(oldTasksSync, newTasksSync);
content = content.replace(oldTasksEnd, newTasksEnd);

fs.writeFileSync(path, content);
console.log('patched backlog viewer sync bypass');