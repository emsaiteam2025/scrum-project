const fs = require('fs');

const pkgPath = '/Users/ems-tainan/.openclaw/workspace/scrum-project/package.json';
const navPath = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/components/Navigation.tsx';

let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const oldVersion = pkg.version;
const parts = oldVersion.split('.');
parts[2] = parseInt(parts[2]) + 1;
const newVersion = parts.join('.');

pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

if (fs.existsSync(navPath)) {
  let nav = fs.readFileSync(navPath, 'utf8');
  nav = nav.replace(new RegExp('v' + oldVersion.replace(/\./g, '\\.'), 'g'), 'v' + newVersion);
  fs.writeFileSync(navPath, nav);
}

console.log(newVersion);