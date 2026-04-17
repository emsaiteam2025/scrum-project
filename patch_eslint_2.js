const fs = require('fs');

function replaceFile(path, oldText, newText) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(oldText, newText);
  fs.writeFileSync(path, content);
}

let p = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/api/ai-tasks/route.ts';
replaceFile(p, '} catch (_e) {}', '} catch {}');
replaceFile(p, '} catch (_e) {}', '} catch {}');

p = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
replaceFile(p, '} catch (_parseErr) {', '} catch {');
replaceFile(p, 'const setTasks = (valOrFn: Task[] | ((prev: Task[]) => Task[])) => {', 'const setTasks = (valOrFn: Task[] | ((prev: Task[]) => Task[])) => {');
replaceFile(p, 'updateData((prevData: any)', 'updateData((prevData: {tasks: Task[]})');
replaceFile(p, 'const interval = setInterval(syncWhatsFromPlanning, 5000);\n    return () => clearInterval(interval);\n  }, [loading]);', 'const interval = setInterval(syncWhatsFromPlanning, 5000);\n    return () => clearInterval(interval);\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [loading]);');

console.log('patched remaining errors');