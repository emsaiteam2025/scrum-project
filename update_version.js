const fs = require('fs');
const pkgPath = '/Users/ems-tainan/.openclaw/workspace/scrum-project/package.json';
const navPath = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/components/Navigation.tsx';

let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = "1.0.1";
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

let nav = fs.readFileSync(navPath, 'utf8');
if (!nav.includes('v1.0.1')) {
  nav = nav.replace(
    `回到專案大廳 (Sprint 清單)\n        </Link>`,
    `回到專案大廳 (Sprint 清單)\n        </Link>\n        <div className="text-[10px] font-bold text-[#b5a695] ml-2 px-2 py-1 bg-[#fffdf9] rounded border border-[#e8d5b5]">v1.0.1</div>`
  );
  fs.writeFileSync(navPath, nav);
}
console.log('done');
