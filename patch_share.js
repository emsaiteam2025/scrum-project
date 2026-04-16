const fs = require('fs');

const pagePath = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/page.tsx';
let pageContent = fs.readFileSync(pagePath, 'utf8');

if (!pageContent.includes('collaboratorEmails?: string[];')) {
  pageContent = pageContent.replace(
    /collaborators\?: { email: string; role: 'editor' \| 'viewer' }\[\];/,
    `collaborators?: { email: string; role: 'editor' | 'viewer' }[];
  collaboratorEmails?: string[];`
  );
}

// update fetching to use 'in' or multiple queries
const fetchLogicOld = `const qOwned = query(sprintsRef, where('ownerId', '==', user.uid));
          const snapOwned = await getDocs(qOwned);
          
          // TODO: 這裡未來可擴充使用 email 搜尋 collaborators
          // 目前先抓取自己建立的專案
          let loaded = snapOwned.docs.map(doc => doc.data() as Sprint);`;

const fetchLogicNew = `const qOwned = query(sprintsRef, where('ownerId', '==', user.uid));
          const snapOwned = await getDocs(qOwned);
          
          let sharedDocs: Sprint[] = [];
          if (user.email) {
            const qShared = query(sprintsRef, where('collaboratorEmails', 'array-contains', user.email));
            const snapShared = await getDocs(qShared);
            sharedDocs = snapShared.docs.map(doc => doc.data() as Sprint);
          }
          
          // 合併去重複
          const allDocs = [...snapOwned.docs.map(d => d.data() as Sprint), ...sharedDocs];
          const uniqueDocsMap = new Map();
          allDocs.forEach(d => uniqueDocsMap.set(d.id, d));
          
          let loaded = Array.from(uniqueDocsMap.values());`;

pageContent = pageContent.replace(fetchLogicOld, fetchLogicNew);

// UI logic: add states for sharing modal
if (!pageContent.includes('const [shareModalSprint, setShareModalSprint]')) {
  pageContent = pageContent.replace(
    `const [loadTimeout, setLoadTimeout] = useState(false);`,
    `const [loadTimeout, setLoadTimeout] = useState(false);
  const [shareModalSprint, setShareModalSprint] = useState<Sprint | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'editor'|'viewer'>('editor');`
  );
}

// function to handle share save
const shareFunc = `
  const handleAddCollaborator = async () => {
    if (!shareModalSprint || !shareEmail) return;
    
    let currentCollabs = shareModalSprint.collaborators || [];
    if (currentCollabs.find(c => c.email === shareEmail)) return;
    
    currentCollabs = [...currentCollabs, { email: shareEmail, role: shareRole }];
    const emails = currentCollabs.map(c => c.email);
    
    const updatedData = { collaborators: currentCollabs, collaboratorEmails: emails };
    
    try {
      await setDoc(doc(db, 'sprints', shareModalSprint.id), updatedData, { merge: true });
      // Update local state directly on the modal sprint as well so the UI updates
      setShareModalSprint({ ...shareModalSprint, ...updatedData });
      setSprints(prev => prev.map(s => s.id === shareModalSprint.id ? { ...s, ...updatedData } : s));
      setShareEmail('');
    } catch(err) {
      console.error(err);
    }
  };
  
  const handleRemoveCollaborator = async (email: string) => {
    if (!shareModalSprint) return;
    
    let currentCollabs = shareModalSprint.collaborators || [];
    currentCollabs = currentCollabs.filter(c => c.email !== email);
    const emails = currentCollabs.map(c => c.email);
    
    const updatedData = { collaborators: currentCollabs, collaboratorEmails: emails };
    
    try {
      await setDoc(doc(db, 'sprints', shareModalSprint.id), updatedData, { merge: true });
      setShareModalSprint({ ...shareModalSprint, ...updatedData });
      setSprints(prev => prev.map(s => s.id === shareModalSprint.id ? { ...s, ...updatedData } : s));
    } catch(err) {
      console.error(err);
    }
  };

  const deleteSprint = async (id: string) => {`;

if (!pageContent.includes('handleAddCollaborator')) {
  pageContent = pageContent.replace(`const deleteSprint = async (id: string) => {`, shareFunc);
}

fs.writeFileSync(pagePath, pageContent);
console.log('Share logic added to page.tsx');