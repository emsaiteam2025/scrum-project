const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/hooks/useAutoSave.ts';
let content = fs.readFileSync(path, 'utf8');

const oldEffect = `  // 載入資料
  useEffect(() => {
    if (authLoading) return;
    
    // 防呆：如果 3 秒內都還沒完成載入，強制結束 loading 狀態，避免畫面永遠卡死
    const fallbackTimer = setTimeout(() => {
      setLoading(false);
      isFirstLoad.current = false;
      console.warn("載入資料逾時，已強制解除 Loading 狀態！");
    }, 3000);`;

const newEffect = `  // 載入資料
  useEffect(() => {
    // 防呆：如果 3 秒內都還沒完成載入 (包含 Firebase Auth 卡死)，強制結束 loading 狀態，避免畫面永遠卡死
    const fallbackTimer = setTimeout(() => {
      setLoading(false);
      isFirstLoad.current = false;
      console.warn("載入資料逾時 (包含 Auth 驗證)，已強制解除 Loading 狀態！");
    }, 3000);

    if (authLoading) return () => clearTimeout(fallbackTimer);`;

content = content.replace(oldEffect, newEffect);
fs.writeFileSync(path, content);
console.log('patched authLoading stuck');