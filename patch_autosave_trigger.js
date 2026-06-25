const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/hooks/useAutoSave.ts';
let content = fs.readFileSync(path, 'utf8');

const oldEffect = `  // 自動儲存
  useEffect(() => {
    if (loading || isFirstLoad.current || !sprintId) return;

    const handler = setTimeout(async () => {`;

const newEffect = `  const [enableSave, setEnableSave] = useState(false);

  // 解除首次載入鎖定
  useEffect(() => {
    if (!loading && isFirstLoad.current) {
      const timer = setTimeout(() => {
        isFirstLoad.current = false;
        setEnableSave(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // 自動儲存
  useEffect(() => {
    if (loading || !enableSave || !sprintId) return;

    const handler = setTimeout(async () => {`;

content = content.replace(oldEffect, newEffect);
content = content.replace('      setTimeout(() => {\n        isFirstLoad.current = false;\n      }, 500);', '');
fs.writeFileSync(path, content);
console.log('patched useAutoSave save trigger');