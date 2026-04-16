const fs = require('fs');
const pagePath = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/page.tsx';
let pageContent = fs.readFileSync(pagePath, 'utf8');

const shareUrlUI = `
               <div className="bg-[#e8eedd] border-2 border-[#5b755e] rounded-xl p-4 mb-4">
                  <h3 className="font-bold text-sm text-[#3e362e] mb-2 flex justify-between items-center">
                    專案專屬網址
                    <button 
                      onClick={() => {
                        const url = \`\${window.location.origin}/?sprint=\${shareModalSprint.id}\`;
                        navigator.clipboard.writeText(url);
                        alert('已複製連結！將此連結傳給擁有權限的協作者，他們點擊即可直接進入。');
                      }}
                      className="text-xs bg-white border-2 border-[#5b755e] px-2 py-1 rounded-lg text-[#5b755e] hover:bg-[#5b755e] hover:text-white transition-colors shadow-sm"
                    >
                      📋 複製
                    </button>
                  </h3>
                  <input 
                    type="text" 
                    readOnly 
                    value={\`\${typeof window !== 'undefined' ? window.location.origin : ''}/?sprint=\${shareModalSprint.id}\`} 
                    className="w-full p-2 border-2 border-[#b5a695] rounded-lg bg-white text-xs text-[#6b5e50] outline-none focus:border-[#5b755e]"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
               </div>

               <div className="bg-[#f4f1ea] border-2 border-[#b5a695] rounded-xl p-4 mb-4">`;

if (!pageContent.includes('專案專屬網址')) {
  pageContent = pageContent.replace(`<div className="bg-[#f4f1ea] border-2 border-[#b5a695] rounded-xl p-4 mb-4">`, shareUrlUI);
}

const effectLogic = `useEffect(() => {
    // 檢查是否有網址參數，若有且載入完成，直接導向
    if (!loading && !authLoading) {
      const params = new URLSearchParams(window.location.search);
      const targetSprintId = params.get('sprint');
      
      if (targetSprintId) {
        const targetSprint = sprints.find(s => s.id === targetSprintId);
        if (targetSprint) {
          // 有權限且找到該專案，自動進入
          selectSprint(targetSprint.id, targetSprint.name);
        } else if (user) {
          // 已經登入，但是找不到專案 (可能沒權限)
          alert('找不到此專案或您沒有權限存取！請確認專案擁有者是否已將您加入協作者。');
          // 移除網址參數以避免重複彈出
          window.history.replaceState({}, '', '/');
        }
      }
    }
  }, [sprints, loading, authLoading, user]);

  return (`;

if (!pageContent.includes('targetSprintId')) {
  pageContent = pageContent.replace(`  return (`, effectLogic);
}

fs.writeFileSync(pagePath, pageContent);
console.log('Share URL added to page.tsx');