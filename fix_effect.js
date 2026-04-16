const fs = require('fs');
const pagePath = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/page.tsx';
let pageContent = fs.readFileSync(pagePath, 'utf8');

const brokenEffect = `useEffect(() => {
    // 如果載入超過 5 秒，顯示逾時提示
    const timer = setTimeout(() => {
      setLoadTimeout(true);
    }, 5000);
  useEffect(() => {
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
  }, [sprints, loading, authLoading, user]);

  return () => clearTimeout(timer);
  }, []);`;

const fixedEffect = `useEffect(() => {
    // 如果載入超過 5 秒，顯示逾時提示
    const timer = setTimeout(() => {
      setLoadTimeout(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
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

pageContent = pageContent.replace(brokenEffect, fixedEffect);

fs.writeFileSync(pagePath, pageContent);
console.log("Fixed effect logic");