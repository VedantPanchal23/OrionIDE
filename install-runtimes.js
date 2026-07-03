/**
 * Install all Piston runtimes needed for Orion IDE
 * Runs installations sequentially since Piston handles one at a time
 */
const http = require('http');

const PISTON = 'http://localhost:2000';

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const { method = 'GET', body } = options;
    const u = new URL(url);
    const reqHeaders = {};
    let bodyStr = null;
    if (body) {
      bodyStr = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const req = http.request({
      hostname: u.hostname, port: u.port,
      path: u.pathname, method, headers: reqHeaders, timeout: 120000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

const LANGUAGES = [
  { language: 'javascript', version: '18.15.0' },
  { language: 'typescript', version: '5.0.3' },
  { language: 'java', version: '15.0.2' },
  { language: 'c++', version: '10.2.0' },
  { language: 'c', version: '10.2.0' },
  { language: 'go', version: '1.16.2' },
  { language: 'rust', version: '1.68.2' },
  { language: 'ruby', version: '3.0.1' },
  { language: 'php', version: '8.2.3' },
  { language: 'csharp', version: '6.12.0' },
  { language: 'swift', version: '5.3.3' },
  { language: 'kotlin', version: '1.8.20' },
  { language: 'r', version: '4.1.1' },
  { language: 'lua', version: '5.4.4' },
  { language: 'perl', version: '5.36.0' },
  { language: 'dart', version: '2.19.6' },
];

async function main() {
  // Check what's already installed
  const res = await request(`${PISTON}/api/v2/runtimes`);
  const installed = new Set((res.data || []).map(r => r.language));
  console.log(`Already installed: ${[...installed].join(', ') || 'none'}`);

  const toInstall = LANGUAGES.filter(l => !installed.has(l.language));
  console.log(`\nNeed to install: ${toInstall.map(l => l.language).join(', ')}\n`);

  for (const lang of toInstall) {
    process.stdout.write(`Installing ${lang.language}@${lang.version}... `);
    try {
      const r = await request(`${PISTON}/api/v2/packages`, {
        method: 'POST',
        body: lang,
      });
      if (r.status === 200) {
        console.log('✅ OK');
      } else {
        console.log(`⚠️  Status ${r.status}: ${JSON.stringify(r.data).substring(0, 100)}`);
      }
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
  }

  // Final check
  const final = await request(`${PISTON}/api/v2/runtimes`);
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Total runtimes installed: ${final.data.length}`);
  console.log(final.data.map(r => `  ${r.language}@${r.version}`).join('\n'));
}

main().catch(console.error);
