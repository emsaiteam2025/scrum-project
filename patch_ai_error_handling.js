const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldCatch = `    } catch (err) {
      console.error(err);
      alert('產生失敗，請確認 API Key 是否有效。');
    } finally {`;

const newCatch = `    } catch (err: any) {
      console.error('AI Generate Error:', err);
      alert('產生失敗：' + (err.message || '未知錯誤') + '\\n請確認 API Key 是否有效，或查看 Console 了解詳細錯誤。');
    } finally {`;

content = content.replace(oldCatch, newCatch);

const oldParse = `      aiContent = aiContent.trim();
      // 過濾 Markdown 語法 (以防 AI 還是輸出了)
      aiContent = aiContent.replace(/^\\s*\`\`\`(json)?/mi, '').replace(/\`\`\`\\s*$/m, '').trim();
      
      const parsedTasks = JSON.parse(aiContent);`;

const newParse = `      // 擷取 JSON 陣列部分 (處理 AI 可能會加上 "好的，這是結果：" 等前言)
      const startIdx = aiContent.indexOf('[');
      const endIdx = aiContent.lastIndexOf(']');
      if (startIdx !== -1 && endIdx !== -1) {
        aiContent = aiContent.substring(startIdx, endIdx + 1);
      }
      
      let parsedTasks = [];
      try {
        parsedTasks = JSON.parse(aiContent);
      } catch (parseErr) {
        console.error("JSON 解析失敗，原始字串為:", aiContent);
        throw new Error("AI 回傳的格式不正確，無法解析為 JSON");
      }`;

content = content.replace(oldParse, newParse);
fs.writeFileSync(path, content);
console.log('patched error handling and json parsing');