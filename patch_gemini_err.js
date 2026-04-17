const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldFetch = `        if (!response.ok) throw new Error('Gemini API 請求失敗');
        const data = await response.json();`;

const newFetch = `        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.error("Gemini API Error details:", errData);
          throw new Error('Gemini API 請求失敗: ' + (errData?.error?.message || response.statusText));
        }
        const data = await response.json();`;

content = content.replace(oldFetch, newFetch);
fs.writeFileSync(path, content);
console.log('patched error details');