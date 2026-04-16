const fs = require('fs');
const pagePath = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/page.tsx';
let pageContent = fs.readFileSync(pagePath, 'utf8');

// Add getDoc to imports
if (!pageContent.includes('getDoc,')) {
  pageContent = pageContent.replace(
    `import { collection, doc, getDocs, setDoc, deleteDoc, query, where } from 'firebase/firestore';`,
    `import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, where } from 'firebase/firestore';`
  );
}

// Update the useEffect logic
const oldEffect = `useEffect(() => {
    // 檢查是否有網址參數，若有且載入完成，直接導向
    if (!loading && !authLoading) {
      const params = new URLSearchParams(window.location.search);
      const targetSprintId = params.get('sprint');
      
      if (targetSprintId) {
        const targetSprint = sprints.find(s => s.id === targetSprintId);
        if (targetSprint) {
          // 有權限且找到該專案，自動進入
          selectSprint(targetSprint.id, targetSprint.name);
        } else if (user) {
          // 已經登入，但是找不到專案 (可能沒權限)
          alert('找不到此專案或您沒有權限存取！請確認專案擁有者是否已將您加入協作者。');
          // 移除網址參數以避免重複彈出
          window.history.replaceState({}, '', '/');
        }
      }
    }
  }, [sprints, loading, authLoading, user]);`;

const newEffect = `useEffect(() => {
    // 檢查是否有網址參數，若有且載入完成，直接導向
    const checkLink = async () => {
      if (!loading && !authLoading) {
        const params = new URLSearchParams(window.location.search);
        const targetSprintId = params.get('sprint');
        
        if (targetSprintId) {
          let targetSprint = sprints.find(s => s.id === targetSprintId);
          
          if (!targetSprint) {
            // 從 Firebase 單獨抓取該專案 (給擁有連結的人檢視)
            try {
              const docRef = doc(db, 'sprints', targetSprintId);
              const snap = await getDoc(docRef);
              if (snap.exists()) {
                targetSprint = snap.data() as Sprint;
              }
            } catch (err) {
              console.error(err);
            }
          }

          if (targetSprint) {
            // 找到該專案，自動進入 (設定一個檢視者標記，可供內部後續擴充權限判斷)
            localStorage.setItem('sprintRole_' + targetSprintId, 'viewer_via_link');
            selectSprint(targetSprint.id, targetSprint.name);
          } else {
            alert('找不到此專案！請確認連結是否正確。');
            window.history.replaceState({}, '', '/');
          }
        }
      }
    };
    checkLink();
  }, [sprints, loading, authLoading, user]);`;

pageContent = pageContent.replace(oldEffect, newEffect);

fs.writeFileSync(pagePath, pageContent);
console.log("Public link patch applied");