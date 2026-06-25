const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/lib/firebase.ts';
let content = fs.readFileSync(path, 'utf8');

const oldProvider = `const googleProvider = new GoogleAuthProvider();`;
const newProvider = `const googleProvider = new GoogleAuthProvider();\n// 強制每次登入都跳出選擇帳號的視窗，避免自動登入預設帳號\ngoogleProvider.setCustomParameters({\n  prompt: 'select_account'\n});`;

content = content.replace(oldProvider, newProvider);
fs.writeFileSync(path, content);
console.log('patched google auth prompt');