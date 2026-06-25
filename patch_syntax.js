const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/hooks/useAutoSave.ts';
let content = fs.readFileSync(path, 'utf8');

const oldEnd = `    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }
  }, [user, authLoading, sprintId, pageKey]);`;

const newEnd = `    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, sprintId, pageKey]);`;

content = content.replace(oldEnd, newEnd);
fs.writeFileSync(path, content);
console.log('fixed syntax error');