const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/daily-scrum/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'const completedDays = data.completedDays;',
  'const completedDays = data.completedDays || [];'
);

content = content.replace(
  'if (completedDays.length !== daysCount && !loading) {',
  'if ((!completedDays || completedDays.length !== daysCount) && !loading) {'
);

fs.writeFileSync(path, content);
console.log('patched daily scrum fallbacks');