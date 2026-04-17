const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/planning/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const startIndex = content.indexOf('  // 模擬 AI 潤飾功能');
const endIndexStr = `    newItems[index].text = generatedContent;
    setter(newItems);
  };`;
const endIndex = content.indexOf(endIndexStr) + endIndexStr.length;

if (startIndex !== -1 && content.indexOf(endIndexStr) !== -1) {
  const oldBlock = content.substring(startIndex, endIndex);

  const newFunc = `  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleAiRewrite = async (setter: React.Dispatch<React.SetStateAction<{ id: string; text: string }[]>>, items: { id: string; text: string }[], index: number, fieldType: 'WHY' | 'WHAT' | 'HOW') => {
    if (!apiKey) {
      alert('⚠️ 請先於頁面頂部輸入您的 API Key，才能啟動魔法潤飾功能！');
      return;
    }

    const poIdea = data.poIdea.trim() || '';
    const newItems = [...items];
    const currentText = newItems[index].text.trim();
    
    setIsAiLoading(true);
    try {
      const response = await fetch('/api/ai-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, fieldType, currentText, poIdea })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || '後端請求失敗');
      }

      const resData = await response.json();
      newItems[index].text = resData.result || currentText;
      setter(newItems);
    } catch (err: any) {
      console.error('AI Rewrite Error:', err);
      alert('潤飾失敗：' + (err.message || '未知錯誤'));
    } finally {
      setIsAiLoading(false);
    }
  };`;

  content = content.replace(oldBlock, newFunc);

  // Add disabled state to buttons
  content = content.replace(/className="text-xs bg-\[\#fceded\] text-\[\#c96262\]/g, 'disabled={isAiLoading} className="text-xs bg-[#fceded] text-[#c96262] disabled:opacity-50');

  fs.writeFileSync(path, content);
  console.log('patched handleAiRewrite');
} else {
  console.log('could not find block', startIndex, content.indexOf(endIndexStr));
}