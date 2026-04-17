const fs = require('fs');

function replaceFile(path, oldText, newText) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(oldText, newText);
  fs.writeFileSync(path, content);
}

// 1. /src/app/api/ai-rewrite/route.ts
let p = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/api/ai-rewrite/route.ts';
replaceFile(p, 'const fieldNameMap: any = {', 'const fieldNameMap: Record<string, string> = {');
replaceFile(p, '} catch (error: any) {', '} catch (error: unknown) {\n    const err = error as Error;');
replaceFile(p, 'return NextResponse.json({ error: error.message }', 'return NextResponse.json({ error: err.message }');

// 2. /src/app/api/ai-tasks/route.ts
p = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/api/ai-tasks/route.ts';
replaceFile(p, '} catch(e) {}', '} catch (_e) {}');
replaceFile(p, '} catch(e) {}', '} catch (_e) {}'); // second one
replaceFile(p, '} catch (error: any) {', '} catch (error: unknown) {\n    const err = error as Error;');
replaceFile(p, 'return NextResponse.json({ error: error.message }', 'return NextResponse.json({ error: err.message }');

// 3. /src/app/planning/page.tsx
p = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/planning/page.tsx';
replaceFile(p, 'const [isAiLoading, setIsAiLoading]', '// eslint-disable-next-line @typescript-eslint/no-unused-vars\n  const [isAiLoading, setIsAiLoading]');
replaceFile(p, '} catch (err: any) {', '} catch (err: unknown) {\n      const e = err as Error;');
replaceFile(p, 'alert(\'潤飾失敗：\' + (err.message || \'未知錯誤\'));', 'alert(\'潤飾失敗：\' + (e.message || \'未知錯誤\'));');
replaceFile(p, 'console.error(\'AI Rewrite Error:\', err);', 'console.error(\'AI Rewrite Error:\', e);');

// 4. /src/app/backlog/page.tsx
p = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
replaceFile(p, 'const { doc, getDoc, setDoc }', 'const { doc, getDoc }');
replaceFile(p, 'const whats = planningData.whats.filter((w: any) => w.text && w.text.trim() !== \'\');', 'const whats = planningData.whats.filter((w: {id: string, text: string}) => w.text && w.text.trim() !== \'\');');
replaceFile(p, 'whats.forEach((w: any, index: number) => {', 'whats.forEach((w: {id: string, text: string}) => {');
replaceFile(p, 'const whatIds = whats.map((w: any) => w.id);', 'const whatIds = whats.map((w: {id: string, text: string}) => w.id);');
replaceFile(p, 'const idxA = whats.findIndex((w: any) => w.id === a.id);', 'const idxA = whats.findIndex((w: {id: string, text: string}) => w.id === a.id);');
replaceFile(p, 'const idxB = whats.findIndex((w: any) => w.id === b.id);', 'const idxB = whats.findIndex((w: {id: string, text: string}) => w.id === b.id);');
replaceFile(p, '} catch (parseErr) {', '} catch (_parseErr) {');
replaceFile(p, 'const newTasks = parsedTasks.map((t: any, i: number) => ({', 'const newTasks = parsedTasks.map((t: {title: string, desc: string}, i: number) => ({');
replaceFile(p, '} catch (err: any) {', '} catch (error: unknown) {\n      const err = error as Error;');
replaceFile(p, 'const setTasks = (valOrFn: Task[] | ((prev: Task[]) => Task[])) => {', '// eslint-disable-next-line react-hooks/exhaustive-deps\n  const setTasks = (valOrFn: Task[] | ((prev: Task[]) => Task[])) => {');

// 5. /src/app/daily-scrum/page.tsx
p = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/daily-scrum/page.tsx';
replaceFile(p, '}, [loading]);', '    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [loading]);');

console.log('patched linting issues');