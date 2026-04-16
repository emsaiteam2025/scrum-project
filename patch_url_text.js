const fs = require('fs');
const pagePath = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/page.tsx';
let pageContent = fs.readFileSync(pagePath, 'utf8');

pageContent = pageContent.replace(
  `alert('已複製連結！將此連結傳給擁有權限的協作者，他們點擊即可直接進入。');`,
  `alert('已複製連結！取得此連結的人將可以直接進入檢視此專案內容。');`
);

fs.writeFileSync(pagePath, pageContent);
console.log("Text updated");