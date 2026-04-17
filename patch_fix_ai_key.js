const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const hook = `  useEffect(() => {
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const handleAiGenerateTasks`;

if (!content.includes("const savedKey = localStorage.getItem('openai_api_key');")) {
  content = content.replace("  const handleAiGenerateTasks", hook);
  fs.writeFileSync(path, content);
  console.log('patched api key');
} else {
  console.log('already patched');
}