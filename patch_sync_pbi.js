const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// The logic: 
// On load (or onSnapshot), fetch planning.whats, and ensure tasks contains all whats.
// Update tasks array with new whats, removing deleted whats, and syncing titles.
const syncLogic = `
  useEffect(() => {
    if (loading) return;

    const syncWhatsFromPlanning = async () => {
      try {
        const sprintId = localStorage.getItem('currentSprintId');
        if (!sprintId) return;

        const { getAuth } = await import('firebase/auth');
        const { doc, getDoc, setDoc } = await import('firebase/firestore');
        const { db, app } = await import('@/lib/firebase');
        const auth = getAuth(app);

        // 如果是分享連結的檢視者，跳過從 users 讀取
        const isPublicViewer = localStorage.getItem('sprintRole_' + sprintId) === 'viewer_via_link';
        
        let planningData = null;
        if (auth.currentUser || isPublicViewer) {
          const docRef = doc(db, 'sprints', sprintId);
          const snap = await getDoc(docRef);
          if (snap.exists() && snap.data().planning) {
            planningData = snap.data().planning;
          }
        } else {
          const localStr = localStorage.getItem(\`sprint_\${sprintId}_planning\`);
          if (localStr) planningData = JSON.parse(localStr);
        }

        if (planningData && planningData.whats) {
          const whats = planningData.whats.filter((w: any) => w.text && w.text.trim() !== '');
          
          setTasks(prev => {
            let newTasks = [...prev];
            let changed = false;
            
            // 1. 同步 Planning 新增或修改的 WHAT
            whats.forEach((w: any, index: number) => {
              const existingIndex = newTasks.findIndex(t => t.id === w.id);
              if (existingIndex >= 0) {
                if (newTasks[existingIndex].title !== w.text) {
                  newTasks[existingIndex] = { ...newTasks[existingIndex], title: w.text };
                  changed = true;
                }
              } else {
                newTasks.push({
                  id: w.id,
                  type: 'pbi',
                  status: 'pbi',
                  title: w.text
                });
                changed = true;
              }
            });

            // 2. 移除在 Planning 中已被刪除的 WHAT
            const whatIds = whats.map((w: any) => w.id);
            const tasksToRemove = newTasks.filter(t => t.type === 'pbi' && !whatIds.includes(t.id));
            if (tasksToRemove.length > 0) {
              newTasks = newTasks.filter(t => t.type !== 'pbi' || whatIds.includes(t.id));
              changed = true;
            }

            // 3. 確保順序與 Planning 的 WHAT 一致
            const pbis = newTasks.filter(t => t.type === 'pbi');
            const others = newTasks.filter(t => t.type !== 'pbi');
            pbis.sort((a, b) => {
              const idxA = whats.findIndex((w: any) => w.id === a.id);
              const idxB = whats.findIndex((w: any) => w.id === b.id);
              return idxA - idxB;
            });
            
            const orderedTasks = [...pbis, ...others];
            
            // 檢查順序是否改變
            const orderChanged = orderedTasks.map(t=>t.id).join(',') !== newTasks.map(t=>t.id).join(',');

            if (changed || orderChanged) {
              return orderedTasks;
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("Sync PBI failed:", err);
      }
    };
    
    syncWhatsFromPlanning();
    
    // 設定每 5 秒同步一次以達成類似即時的效果
    const interval = setInterval(syncWhatsFromPlanning, 5000);
    return () => clearInterval(interval);
  }, [loading]);
`;

if (content.includes('// 初始化時，如果看板是空的，自動從 Planning 頁面的 WHAT 載入 PBI')) {
  const blockStart = content.indexOf('// 初始化時，如果看板是空的，自動從 Planning 頁面的 WHAT 載入 PBI');
  const blockEnd = content.indexOf('  const handleAiGenerateTasks', blockStart);
  if (blockStart !== -1 && blockEnd !== -1) {
    const block = content.substring(blockStart, blockEnd);
    content = content.replace(block, syncLogic + '\n\n');
  } else {
     const fallbackEnd = content.indexOf('  const handleDaysChange', blockStart);
     if (blockStart !== -1 && fallbackEnd !== -1) {
       const block = content.substring(blockStart, fallbackEnd);
       content = content.replace(block, syncLogic + '\n\n');
     }
  }
}

fs.writeFileSync(path, content);
console.log('patched sync');