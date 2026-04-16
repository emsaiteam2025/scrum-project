const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const { data, updateData, loading } = useAutoSave('backlog', {`,
  `  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const { data, updateData, loading } = useAutoSave('backlog', {`
);

content = content.replace(
  `  useEffect(() => {
    if (sprintDays) {
      localStorage.setItem('sprintDays', sprintDays.toString());
    }
  }, [sprintDays]);`,
  `  useEffect(() => {
    if (sprintDays) {
      localStorage.setItem('sprintDays', sprintDays.toString());
    }
  }, [sprintDays]);

  // 初始化時，如果看板是空的，自動從 Planning 頁面的 WHAT 載入 PBI
  useEffect(() => {
    if (loading || tasks.length > 0) return;

    const loadWhatsFromPlanning = async () => {
      try {
        const sprintId = localStorage.getItem('currentSprintId');
        if (!sprintId) return;

        let planningData = null;
        
        // 為了避免重複匯入或報錯，我們先從 localStorage 同步讀取試試
        // (如果你有登入，Firebase 也會同步寫一份到 user 的雲端，我們可以直接查雲端，但為了快速可用，這裡兩邊都抓)
        const localSaved = localStorage.getItem(\`sprint_\${sprintId}_planning\`);
        if (localSaved) {
           planningData = JSON.parse(localSaved);
        }

        if (planningData && planningData.whats && Array.isArray(planningData.whats)) {
          // 過濾掉空字串的 WHAT
          const validWhats = planningData.whats.filter((w: any) => w.text && w.text.trim().length > 0);
          
          if (validWhats.length > 0) {
            const newPbis: Task[] = validWhats.map((w: any, index: number) => ({
              id: \`pbi-auto-\${Date.now()}-\${index}\`,
              type: 'pbi',
              status: 'pbi',
              title: w.text.trim(),
              desc: '',
              role: '',
              time: ''
            }));
            
            // 使用 setTasks 寫入 (會自動儲存)
            setTasks(newPbis);
          }
        }
      } catch (err) {
        console.error("Auto load PBI failed:", err);
      }
    };
    
    loadWhatsFromPlanning();
  }, [loading]); // 僅在 loading 結束時觸發一次`
);

fs.writeFileSync(path, content);
console.log('done');
