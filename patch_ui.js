const fs = require('fs');
const pagePath = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/page.tsx';
let pageContent = fs.readFileSync(pagePath, 'utf8');

const oldCardButtons = `                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingId(isEditing ? null : sprint.id); }} 
                        className="text-[#76a5af] hover:bg-[#e8eedd] p-1.5 rounded transition-colors"
                        title="編輯名稱"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteSprint(sprint.id); }} 
                        className="text-[#c96262] hover:bg-[#fceded] p-1.5 rounded transition-colors"
                        title="刪除"
                      >
                        🗑️
                      </button>
                    </div>`;

const newCardButtons = `                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setShareModalSprint(sprint); }} 
                        className="text-[#8b5a2b] hover:bg-[#faebce] p-1.5 rounded transition-colors"
                        title="共享設定"
                      >
                        👥
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingId(isEditing ? null : sprint.id); }} 
                        className="text-[#76a5af] hover:bg-[#e8eedd] p-1.5 rounded transition-colors"
                        title="編輯名稱"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteSprint(sprint.id); }} 
                        className="text-[#c96262] hover:bg-[#fceded] p-1.5 rounded transition-colors"
                        title="刪除"
                      >
                        🗑️
                      </button>
                    </div>`;

pageContent = pageContent.replace(oldCardButtons, newCardButtons);

// insert Share Modal at the bottom, just before </main>
const shareModalStr = `
        {/* Share Modal */}
        {shareModalSprint && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-[#fffdf9] border-4 border-[#5b755e] rounded-3xl p-6 shadow-2xl max-w-md w-full relative">
               <button onClick={() => setShareModalSprint(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold text-xl">✕</button>
               <h2 className="text-xl font-bold text-[#5b755e] mb-4 flex items-center gap-2"><span>👥</span> 共享專案</h2>
               <p className="text-sm font-bold text-[#6b5e50] mb-4">專案名稱：{shareModalSprint.name}</p>
               
               <div className="bg-[#f4f1ea] border-2 border-[#b5a695] rounded-xl p-4 mb-4">
                  <h3 className="font-bold text-sm text-[#3e362e] mb-2">已加入的協作者</h3>
                  {(!shareModalSprint.collaborators || shareModalSprint.collaborators.length === 0) ? (
                    <div className="text-xs text-[#8a7f72] py-2">目前沒有協作者</div>
                  ) : (
                    <ul className="space-y-2">
                       {shareModalSprint.collaborators.map(c => (
                         <li key={c.email} className="flex justify-between items-center text-sm font-bold bg-white px-3 py-2 border border-[#d3cbbd] rounded-lg">
                           <span className="truncate flex-1 text-[#3e362e]">{c.email}</span>
                           <span className="text-xs px-2 py-1 bg-[#e8eedd] text-[#4a7c59] rounded mx-2">{c.role === 'editor' ? '編輯' : '檢視'}</span>
                           <button onClick={() => handleRemoveCollaborator(c.email)} className="text-red-500 hover:text-red-700">🗑️</button>
                         </li>
                       ))}
                    </ul>
                  )}
               </div>
               
               <div className="space-y-3">
                 <h3 className="font-bold text-sm text-[#3e362e]">新增協作者 (Google Email)</h3>
                 <div className="flex gap-2">
                   <input 
                     type="email" 
                     value={shareEmail} 
                     onChange={e => setShareEmail(e.target.value)} 
                     placeholder="輸入Email..."
                     className="flex-1 p-2 border-2 border-[#b5a695] rounded-lg focus:outline-none focus:border-[#5b755e] font-bold text-sm"
                   />
                   <select 
                     value={shareRole} 
                     onChange={e => setShareRole(e.target.value as 'editor'|'viewer')}
                     className="p-2 border-2 border-[#b5a695] rounded-lg bg-white focus:outline-none font-bold text-sm text-[#6b5e50]"
                   >
                     <option value="editor">編輯</option>
                     <option value="viewer">檢視</option>
                   </select>
                 </div>
                 <button 
                   onClick={handleAddCollaborator}
                   className="w-full bg-[#5b755e] text-white font-bold py-2 rounded-lg hover:bg-[#4a614d] transition-colors"
                 >
                   邀請加入
                 </button>
               </div>
            </div>
          </div>
        )}
      </div>
    </main>`;

if (!pageContent.includes('Share Modal')) {
  pageContent = pageContent.replace(/<\/div>\s*<\/main>/, shareModalStr);
}

fs.writeFileSync(pagePath, pageContent);
console.log('Modal added');