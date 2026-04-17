const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/hooks/useAutoSave.ts';
let content = fs.readFileSync(path, 'utf8');

const oldLoad = `  // 載入資料
  useEffect(() => {
    if (authLoading || !sprintId) return;

    const loadData = async () => {
      if (user) {
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
      setTimeout(() => {
        isFirstLoad.current = false;
      }, 500);
    };
    loadData();
  }, [user, authLoading, sprintId, pageKey]);`;

const newLoad = `  // 載入資料
  useEffect(() => {
    if (authLoading || !sprintId) return;

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
      setTimeout(() => {
        isFirstLoad.current = false;
      }, 500);
    };
    loadData();
  }, [user, authLoading, sprintId, pageKey]);`;

const oldSave = `  // 自動儲存
  useEffect(() => {
    if (loading || isFirstLoad.current || !sprintId) return;

    const handler = setTimeout(async () => {
      if (user) {
        try {
          const docRef = doc(db, 'sprints', sprintId);
          await setDoc(docRef, { [pageKey]: data }, { merge: true });
          console.log(\`[Autosave] Cloud sync success: \${pageKey}\`);
        } catch (error) {
          console.error("[Autosave] Cloud sync failed:", error);
        }
      } else {
        localStorage.setItem(\`sprint_\${sprintId}_\${pageKey}\`, JSON.stringify(data));
        console.log(\`[Autosave] Local sync success: \${pageKey}\`);
      }
    }, 1000); // 防抖 1 秒

    return () => clearTimeout(handler);
  }, [data, user, loading, sprintId, pageKey]);`;

const newSave = `  // 自動儲存
  useEffect(() => {
    if (loading || isFirstLoad.current || !sprintId) return;

    const handler = setTimeout(async () => {
      const isPublicViewer = localStorage.getItem('sprintRole_' + sprintId) === 'viewer_via_link';
      if (isPublicViewer && !user) {
        return; // 公開檢視者（未登入）不允許寫入雲端
      }

      if (user) {
        try {
          const docRef = doc(db, 'sprints', sprintId);
          await setDoc(docRef, { [pageKey]: data }, { merge: true });
          console.log(\`[Autosave] Cloud sync success: \${pageKey}\`);
        } catch (error) {
          console.error("[Autosave] Cloud sync failed:", error);
        }
      } else {
        localStorage.setItem(\`sprint_\${sprintId}_\${pageKey}\`, JSON.stringify(data));
        console.log(\`[Autosave] Local sync success: \${pageKey}\`);
      }
    }, 1000); // 防抖 1 秒

    return () => clearTimeout(handler);
  }, [data, user, loading, sprintId, pageKey]);`;

content = content.replace(oldLoad, newLoad).replace(oldSave, newSave);
fs.writeFileSync(path, content);
console.log('patched autosave');