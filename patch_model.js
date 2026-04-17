const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'models/gemini-1.5-flash:generateContent',
  'models/gemini-3.1-flash:generateContent'
);

fs.writeFileSync(path, content);
console.log('patched model version');