/**
 * Install missing runtimes with CORRECT Piston package names
 */
const http = require('http');
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const { method = 'GET', body } = options;
    const u = new URL(url);
    const reqHeaders = {};
    let bodyStr = null;
    if (body) { bodyStr = JSON.stringify(body); reqHeaders['Content-Type'] = 'application/json'; reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr); }
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method, headers: reqHeaders, timeout: 120000 }, (res) => {
      let data = ''; res.on('data', c => data += c); res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, data }); } });
    });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (bodyStr) req.write(bodyStr); req.end();
  });
}

const MISSING = [
  { language: 'node', version: '18.15.0' },      // JavaScript
  { language: 'gcc', version: '10.2.0' },          // C/C++
  { language: 'dotnet', version: '5.0.201' },      // C#
  { language: 'kotlin', version: '1.8.20' },
  { language: 'swift', version: '5.3.3' },
  { language: 'lua', version: '5.4.4' },
  { language: 'perl', version: '5.36.0' },
  { language: 'r', version: '4.1.1' },
  { language: 'dart', version: '2.19.6' },
];

async function main() {
  for (const lang of MISSING) {
    process.stdout.write(`Installing ${lang.language}@${lang.version}... `);
    try {
      const r = await request('http://localhost:2000/api/v2/packages', { method: 'POST', body: lang });
      console.log(r.status === 200 ? '✅ OK' : `⚠️ ${r.status}: ${JSON.stringify(r.data).substring(0, 80)}`);
    } catch (err) { console.log(`❌ ${err.message}`); }
  }
  // Final runtime count
  const res = await request('http://localhost:2000/api/v2/runtimes');
  console.log(`\nTotal installed: ${res.data.length} runtimes`);
  console.log(res.data.map(r => `  ${r.language}@${r.version} (aliases: ${(r.aliases || []).join(',')})`).join('\n'));
}
main();
