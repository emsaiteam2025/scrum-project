const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/hooks/useAutoSave.ts';
let content = fs.readFileSync(path, 'utf8');

const oldEffect = `  // 載入資料
  useEffect(() => {
    if (authLoading) return;
    
    // 如果沒有 sprintId (例如從首頁剛進來還沒設定好)，也要停止 loading 狀態，不然畫面會卡住
    if (!sprintId) {
      if (!loading) return; // 已經停止 loading 就不重複
      const timer = setTimeout(() => {
        // 如果 1 秒後還是沒有 sprintId，就強制解除 loading 以免卡住
        if (!localStorage.getItem('currentSprintId')) {
           setLoading(false);
           isFirstLoad.current = false;
        }
      }, 1000);
      return () => clearTimeout(timer);
    }

    const loadData = async () => {`;

const newEffect = `  // 載入資料
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

    const loadData = async () => {`;

content = content.replace(oldEffect, newEffect);
fs.writeFileSync(path, content);
console.log('patched useAutoSave load state 2');