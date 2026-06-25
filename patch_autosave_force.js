const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/hooks/useAutoSave.ts';
let content = fs.readFileSync(path, 'utf8');

const oldDeps = `    }, 1000); // 防抖 1 秒

    return () => clearTimeout(handler);
  }, [data, user, loading, sprintId, pageKey]);`;

const newDeps = `    }, 1000); // 防抖 1 秒

    return () => clearTimeout(handler);
  }, [data, user, loading, sprintId, pageKey, enableSave]);

  const forceSave = async () => {
    if (loading || !sprintId) return;
    const isPublicViewer = localStorage.getItem('sprintRole_' + sprintId) === 'viewer_via_link';
    if (isPublicViewer && !user) return;

    if (user) {
      try {
        const docRef = doc(db, 'sprints', sprintId);
        await setDoc(docRef, { [pageKey]: data }, { merge: true });
        console.log(\`[Force Save] Cloud sync success: \${pageKey}\`);
      } catch (error) {
        console.error("[Force Save] Cloud sync failed:", error);
      }
    } else {
      localStorage.setItem(\`sprint_\${sprintId}_\${pageKey}\`, JSON.stringify(data));
      console.log(\`[Force Save] Local sync success: \${pageKey}\`);
    }
  };`;

content = content.replace(oldDeps, newDeps);

const oldReturn = `  return { data, updateData, loading };`;
const newReturn = `  return { data, updateData, loading, forceSave };`;
content = content.replace(oldReturn, newReturn);

fs.writeFileSync(path, content);
console.log('patched useAutoSave for forceSave');