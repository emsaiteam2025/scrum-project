const fetch = require('node-fetch');

async function test() {
  try {
    const res = await fetch('http://localhost:3001/api/ai-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pbiTitle: 'test', apiKey: 'fake_key_so_it_fails' })
    });
    console.log(res.status, await res.text());
  } catch(e) { console.error(e) }
}
test();