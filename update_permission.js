const fs = require('fs');
const path = require('path');

// 1. 修改 Sprint 介面與首頁
const pagePath = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/page.tsx';
let pageContent = fs.readFileSync(pagePath, 'utf8');

pageContent = pageContent.replace(
  `interface Sprint {\n  id: string;\n  name: string;\n  createdAt: number;\n}`,
  `interface Sprint {\n  id: string;\n  name: string;\n  createdAt: number;\n  ownerId?: string;\n  collaborators?: { email: string; role: 'editor' | 'viewer' }[];\n}`
);

pageContent = pageContent.replace(
  `import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';`,
  `import { collection, doc, getDocs, setDoc, deleteDoc, query, where } from 'firebase/firestore';`
);

pageContent = pageContent.replace(
  `const sprintsRef = collection(db, 'users', user.uid, 'sprints');\n          const snapshot = await getDocs(sprintsRef);\n          if (!snapshot.empty) {\n            let loaded = snapshot.docs.map(doc => doc.data() as Sprint);`,
  `const sprintsRef = collection(db, 'sprints');\n          const qOwned = query(sprintsRef, where('ownerId', '==', user.uid));\n          const snapOwned = await getDocs(qOwned);\n          \n          // TODO: 這裡未來可擴充使用 email 搜尋 collaborators\n          // 目前先抓取自己建立的專案\n          let loaded = snapOwned.docs.map(doc => doc.data() as Sprint);\n          if (loaded.length > 0) {`
);

pageContent = pageContent.replace(
  `await deleteDoc(doc(db, 'users', user.uid, 'sprints', bad.id || 'default'));`,
  `await deleteDoc(doc(db, 'sprints', bad.id || 'default'));`
);

pageContent = pageContent.replace(
  `await setDoc(doc(sprintsRef, initial[0].id), initial[0]);`,
  `await setDoc(doc(db, 'sprints', initial[0].id), { ...initial[0], ownerId: user.uid, collaborators: [] });`
);

pageContent = pageContent.replace(
  `    const newSprint: Sprint = {
      id: \`sprint-\${Date.now()}\`,
      name: '未命名的新 Sprint',
      createdAt: Date.now()
    };
    const updated = [newSprint, ...sprints];
    setSprints(updated);
    setEditingId(newSprint.id);

    if (user) {
      const sprintRef = doc(db, 'users', user.uid, 'sprints', newSprint.id);
      await setDoc(sprintRef, newSprint);`,
  `    const newSprint: Sprint = {
      id: \`sprint-\${Date.now()}\`,
      name: '未命名的新 Sprint',
      createdAt: Date.now(),
      ownerId: user ? user.uid : undefined,
      collaborators: []
    };
    const updated = [newSprint, ...sprints];
    setSprints(updated);
    setEditingId(newSprint.id);

    if (user) {
      const sprintRef = doc(db, 'sprints', newSprint.id);
      await setDoc(sprintRef, newSprint);`
);

pageContent = pageContent.replace(
  `await deleteDoc(doc(db, 'users', user.uid, 'sprints', id));`,
  `await deleteDoc(doc(db, 'sprints', id));`
);

pageContent = pageContent.replace(
  `await setDoc(doc(db, 'users', user.uid, 'sprints', id), updatedData, { merge: true });`,
  `await setDoc(doc(db, 'sprints', id), updatedData, { merge: true });`
);

fs.writeFileSync(pagePath, pageContent);

// 2. 修改 autoSave
const hookPath = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/hooks/useAutoSave.ts';
let hookContent = fs.readFileSync(hookPath, 'utf8');

hookContent = hookContent.replace(
  `const docRef = doc(db, 'users', user.uid, 'sprints', sprintId);`,
  `const docRef = doc(db, 'sprints', sprintId);`
);

hookContent = hookContent.replace(
  `const docRef = doc(db, 'users', user.uid, 'sprints', sprintId);`,
  `const docRef = doc(db, 'sprints', sprintId);`
);

fs.writeFileSync(hookPath, hookContent);

console.log('done');
