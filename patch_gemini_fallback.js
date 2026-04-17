const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldGemini = `        // 使用 Google Gemini API (改用 OpenAI 相容模式，並指定 gemini-3.1-flash，若失敗會嘗試降級)
        let response = await fetch(\`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions\`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${apiKey}\`
          },
          body: JSON.stringify({
            model: "gemini-3.1-flash",
            messages: [
              { role: "system", content: "你是一個專業的 Scrum Master 與資深開發者。請幫我將以下 Product Backlog Item (PBI) 拆解成 3 到 5 個具體的 Task (待辦任務)。以 JSON 陣列格式回傳，每個任務包含 title (標題) 與 desc (簡短描述)。不要回傳 Markdown 標籤，直接回傳 JSON 陣列即可。例如：[{\\"title\\":\\"建立資料表\\", \\"desc\\":\\"建立 users 資料表\\"}]" },
              { role: "user", content: \`PBI: \${pbiTitle}\` }
            ],
            temperature: 0.7
          })
        });
        
        // 如果 3.1-flash 找不到，自動降級到 gemini-pro
        if (response.status === 404 || response.status === 400) {
          response = await fetch(\`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions\`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': \`Bearer \${apiKey}\`
            },
            body: JSON.stringify({
              model: "gemini-pro",
              messages: [
                { role: "system", content: "你是一個專業的 Scrum Master 與資深開發者。請幫我將以下 Product Backlog Item (PBI) 拆解成 3 到 5 個具體的 Task (待辦任務)。以 JSON 陣列格式回傳，每個任務包含 title (標題) 與 desc (簡短描述)。不要回傳 Markdown 標籤，直接回傳 JSON 陣列即可。例如：[{\\"title\\":\\"建立資料表\\", \\"desc\\":\\"建立 users 資料表\\"}]" },
                { role: "user", content: \`PBI: \${pbiTitle}\` }
              ],
              temperature: 0.7
            })
          });
        }

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.error("Gemini API Error details:", errData);
          throw new Error('Gemini API 請求失敗: ' + (errData?.error?.message || response.statusText));
        }
        const data = await response.json();
        aiContent = data.choices?.[0]?.message?.content || '';`;

const newGemini = `        // 回歸使用最穩定且支援 CORS 的原生 API，模型名稱使用 Google 官方定義的 gemini-1.5-flash
        const response = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\${apiKey}\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ 
              parts: [
                { text: "你是一個專業的 Scrum Master 與資深開發者。請幫我將以下 Product Backlog Item (PBI) 拆解成 3 到 5 個具體的 Task (待辦任務)。以 JSON 陣列格式回傳，每個任務包含 title (標題) 與 desc (簡短描述)。不要回傳 Markdown 標籤，直接回傳 JSON 陣列即可。例如：[{\\"title\\":\\"建立資料表\\", \\"desc\\":\\"建立 users 資料表\\"}]\\n\\nPBI: " + pbiTitle }
              ] 
            }],
            generationConfig: { temperature: 0.7 }
          })
        });

        if (!response.ok) {
          let errMessage = response.statusText;
          try {
            const errData = await response.json();
            errMessage = errData?.error?.message || response.statusText;
          } catch(e) {}
          throw new Error('Gemini API 請求失敗: ' + errMessage);
        }
        
        const data = await response.json();
        aiContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';`;

content = content.replace(oldGemini, newGemini);
fs.writeFileSync(path, content);
console.log('patched gemini back to generateContent');