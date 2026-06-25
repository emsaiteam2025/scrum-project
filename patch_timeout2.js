const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/hooks/useAutoSave.ts';
let content = fs.readFileSync(path, 'utf8');

const oldEffect = `  // 載入資料
  useEffect(() => {
    if (authLoading) return;
    
    // 如果沒有 sprintId，我們給它一個極短的等待時間看會不會抓到
    if (!sprintId) {
      const timer = setTimeout(() => {
         setLoading(false);
         isFirstLoad.current = false;
      }, 300);
      return () => clearTimeout(timer);
    }

    const loadData = async () => {
      const isPublicViewer = localStorage.getItem('sprintRole_' + sprintId) === 'viewer_via_link';
      
      if (user || isPublicViewer) {
        try {
          const docRef = doc(db, 'sprints', sprintId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data()[pageKey]) {
            setData({ ...initialData, ...docSnap.data()[pageKey] });
          }
        } catch (error) {
          console.error("載入失敗:", error);
        }
      } else {
        try {
          const saved = localStorage.getItem(\`sprint_\${sprintId}_\${pageKey}\`);
          if (saved) {
            setData({ ...initialData, ...JSON.parse(saved) });
          }
        } catch (error) {
          console.error("讀取本地資料失敗:", error);
        }
      }
      setLoading(false);
      // 給予一點延遲，避免載入的初始設定觸發第一次的 autosave

    };
    loadData();
  }, [user, authLoading, sprintId, pageKey]);`;

const newEffect = `  // 載入資料
  useEffect(() => {
    if (authLoading) return;
    
    // 防呆：如果 3 秒內都還沒完成載入，強制結束 loading 狀態，避免畫面永遠卡死
    const fallbackTimer = setTimeout(() => {
      setLoading(false);
      isFirstLoad.current = false;
      console.warn("載入資料逾時，已強制解除 Loading 狀態！");
    }, 3000);
    
    // 如果沒有 sprintId (或是字串 null/undefined)，提早結束 loading
    if (!sprintId || sprintId === 'null' || sprintId === 'undefined') {
      clearTimeout(fallbackTimer);
      setLoading(false);
      isFirstLoad.current = false;
      return;
    }

    const loadData = async () => {
      const isPublicViewer = localStorage.getItem('sprintRole_' + sprintId) === 'viewer_via_link';
      
      if (user || isPublicViewer) {
        try {
          const docRef = doc(db, 'sprints', sprintId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data()[pageKey]) {
            setData({ ...initialData, ...docSnap.data()[pageKey] });
          }
        } catch (error) {
          console.error("載入失敗:", error);
        }
      } else {
        try {
          const saved = localStorage.getItem(\`sprint_\${sprintId}_\${pageKey}\`);
          if (saved) {
            setData({ ...initialData, ...JSON.parse(saved) });
          }
        } catch (error) {
          console.error("讀取本地資料失敗:", error);
        }
      }
      
      clearTimeout(fallbackTimer);
      setLoading(false);
      isFirstLoad.current = false;
    };
    
    loadData();
    
    return () => clearTimeout(fallbackTimer);
  }, [user, authLoading, sprintId, pageKey]);`;

content = content.replace(oldEffect, newEffect);
fs.writeFileSync(path, content);
console.log('patched timeout properly');