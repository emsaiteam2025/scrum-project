const fs = require('fs');
const path = '/Users/ems-tainan/.openclaw/workspace/scrum-project/src/app/backlog/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldSync = `            return prev;
          });
        }
      } catch (err) {
        console.error("Sync PBI failed:", err);
      }
    };`;

const newSync = `            return prev;
          });
        } // end of if (planningData.whats)
        } // end of if (planningData)
      } catch (err) {
        console.error("Sync PBI failed:", err);
      }
    };`;

content = content.replace(oldSync, newSync);
fs.writeFileSync(path, content);
console.log('fixed missing bracket');