const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `let changed = false;`,
  `// eslint-disable-next-line @typescript-eslint/no-unused-vars\n            let changed = false;`
);

content = content.replace(
  `const hashTask = (t: any) =>`,
  `const hashTask = (t: {id: string, title: string, desc: string, status: string, role: string, time: string, pbiId: string}) =>`
);

fs.writeFileSync(path, content);
console.log('patched typescript errors');