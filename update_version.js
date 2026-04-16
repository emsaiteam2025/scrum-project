const fs = require('fs');
const pkgPath = '/Users/ems-tainan/.openclaw/workspace/scrum-project/package.json';
const navPath = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/components/Navigation.tsx';

let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = "1.0.2";
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

let nav = fs.readFileSync(navPath, 'utf8');
nav = nav.replace(/v1\.0\.1/g, 'v1.0.2');
fs.writeFileSync(navPath, nav);
console.log('done');
