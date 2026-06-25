const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/hooks/useAutoSave.ts';
let content = fs.readFileSync(path, 'utf8');

const oldFallback = `  // 防卡死計時器：只要 loading 是 true 就開始計時 3 秒，時間到強制解除
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
  }, [loading]);`;

const newFallback = `  // 防卡死計時器：只要 loading 是 true 就開始計時 3 秒，時間到強制解除
  useEffect(() => {
    if (!loading) return;
    const fallbackTimer = setTimeout(() => {
      console.warn("載入資料逾時，已強制解除 Loading 狀態！");
      isFirstLoad.current = false;
      setLoading(false);
    }, 3000);
    return () => clearTimeout(fallbackTimer);
  }, [loading]);`;

content = content.replace(oldFallback, newFallback);
fs.writeFileSync(path, content);
console.log('patched fallback ref mutation properly');