const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/hooks/useAutoSave.ts';
let content = fs.readFileSync(path, 'utf8');

const oldEffect = `  // 載入資料
  useEffect(() => {
    // 防呆：如果 3 秒內都還沒完成載入 (包含 Firebase Auth 卡死)，強制結束 loading 狀態，避免畫面永遠卡死
    const fallbackTimer = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn("載入資料逾時 (包含 Auth 驗證)，已強制解除 Loading 狀態！");
          isFirstLoad.current = false;
          return false;
        }
        return prev;
      });
    }, 3000);

    if (authLoading) {
      // 這裡不能 return 提早結束，否則 setTimeout 的倒數不會執行
      // 我們讓它繼續掛著 fallbackTimer，等待 authLoading 結束或是時間到
      return () => clearTimeout(fallbackTimer);
    }
    
    // 如果沒有 sprintId (或是字串 null/undefined)，提早結束 loading
    if (!sprintId || sprintId === 'null' || sprintId === 'undefined') {
      clearTimeout(fallbackTimer);
      setLoading(false);
      isFirstLoad.current = false;
      return;
    }`;

const newEffect = `  // 防卡死計時器：只要 loading 是 true 就開始計時 3 秒，時間到強制解除
  useEffect(() => {
    if (!loading) return;
    const fallbackTimer = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn("載入資料逾時，已強制解除 Loading 狀態！");
          isFirstLoad.current = false;
          return false;
        }
        return prev;
      });
    }, 3000);
    return () => clearTimeout(fallbackTimer);
  }, [loading]);

  // 載入資料
  useEffect(() => {
    if (authLoading) return;
    
    // 如果沒有 sprintId (或是字串 null/undefined)，提早結束 loading
    if (!sprintId || sprintId === 'null' || sprintId === 'undefined') {
      setLoading(false);
      isFirstLoad.current = false;
      return;
    }`;

content = content.replace(oldEffect, newEffect);

const oldClear = `      clearTimeout(fallbackTimer);
      setLoading(false);
      isFirstLoad.current = false;
    };
    
    loadData();
    
    return () => clearTimeout(fallbackTimer);`;

const newClear = `      setLoading(false);
      isFirstLoad.current = false;
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }`;

content = content.replace(oldClear, newClear);
fs.writeFileSync(path, content);
console.log('patched loading logic completely');