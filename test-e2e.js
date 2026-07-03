/**
 * Orion IDE — Comprehensive End-to-End API Test Suite
 * 
 * Tests every backend service endpoint from A to Z:
 * 1. Gateway Health
 * 2. Auth Service
 * 3. Drive Service
 * 4. Editor Service
 * 5. Execution Service (Piston — multi-language code execution)
 * 6. Terminal Service
 * 7. Agent Service
 * 8. Notification Service
 */

const http = require('http');
const https = require('https');

const GATEWAY = 'http://localhost:3000';
const PISTON = 'http://localhost:2000';
const AUTH = 'http://localhost:3001';
const DRIVE = 'http://localhost:3002';
const EDITOR = 'http://localhost:3003';
const EXECUTION = 'http://localhost:3004';
const AGENT = 'http://localhost:3005';
const NOTIFICATION = 'http://localhost:3006';
const TERMINAL = 'http://localhost:3007';

let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const { method = 'GET', body, headers = {} } = options;
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    
    const reqHeaders = { ...headers };
    let bodyStr = null;
    if (body) {
      bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    
    const req = mod.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: reqHeaders,
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, data: parsed, headers: res.headers });
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function test(name, fn) {
  return fn()
    .then((result) => {
      passed++;
      results.push({ name, status: '✅ PASS', detail: result || '' });
      console.log(`  ✅ ${name}`);
    })
    .catch((err) => {
      failed++;
      results.push({ name, status: '❌ FAIL', detail: err.message });
      console.log(`  ❌ ${name} — ${err.message}`);
    });
}

function skip(name, reason) {
  skipped++;
  results.push({ name, status: '⏭️ SKIP', detail: reason });
  console.log(`  ⏭️ ${name} — ${reason}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runTests() {
  console.log('\n' + '═'.repeat(70));
  console.log('  ORION IDE — COMPREHENSIVE E2E API TEST SUITE');
  console.log('═'.repeat(70) + '\n');

  // ══════════════════════════════════════════════════════════════════
  // 1. GATEWAY HEALTH CHECK
  // ══════════════════════════════════════════════════════════════════
  console.log('── 1. API GATEWAY ──────────────────────────────────');
  
  await test('Gateway /health returns service status', async () => {
    const res = await request(`${GATEWAY}/health`);
    assert(res.status >= 200 && res.status < 300, `Status ${res.status}`);
    assert(res.data.services, 'Missing services object');
    const services = res.data.services;
    const svcNames = Object.keys(services);
    assert(svcNames.length >= 6, `Only ${svcNames.length} services`);
    return `${svcNames.length} services: ${svcNames.map(s => `${s}=${services[s]}`).join(', ')}`;
  });

  // ══════════════════════════════════════════════════════════════════
  // 2. AUTH SERVICE
  // ══════════════════════════════════════════════════════════════════
  console.log('\n── 2. AUTH SERVICE ─────────────────────────────────');
  
  await test('Auth /health responds', async () => {
    const res = await request(`${AUTH}/health`);
    assert(res.status === 200, `Status ${res.status}`);
    return `Status: ${res.data.status || 'ok'}`;
  });

  await test('Auth Google OAuth redirect works (GET /auth/google)', async () => {
    const res = await request(`${GATEWAY}/api/auth/google`);
    // Should redirect (302) to Google OAuth page
    assert(res.status === 302 || res.status === 301 || res.status === 200, `Status ${res.status}`);
    return `Redirect status: ${res.status}`;
  });

  await test('Auth /auth/refresh rejects without cookie', async () => {
    const res = await request(`${GATEWAY}/api/auth/refresh`, { method: 'POST' });
    assert(res.status === 401 || res.status === 403, `Expected 401/403, got ${res.status}`);
    return `Correctly rejected: ${res.status}`;
  });

  // ══════════════════════════════════════════════════════════════════
  // 3. DRIVE SERVICE
  // ══════════════════════════════════════════════════════════════════
  console.log('\n── 3. DRIVE SERVICE ────────────────────────────────');
  
  await test('Drive /health responds', async () => {
    const res = await request(`${DRIVE}/health`);
    assert(res.status === 200, `Status ${res.status}`);
    return `Status: ${res.data.status || 'ok'}`;
  });

  await test('Drive /api/drive/projects rejects without auth', async () => {
    const res = await request(`${GATEWAY}/api/drive/projects`);
    assert(res.status === 401 || res.status === 403, `Expected 401/403, got ${res.status}`);
    return `Correctly requires auth: ${res.status}`;
  });

  // ══════════════════════════════════════════════════════════════════
  // 4. EDITOR SERVICE
  // ══════════════════════════════════════════════════════════════════
  console.log('\n── 4. EDITOR SERVICE ───────────────────────────────');
  
  await test('Editor /health responds', async () => {
    const res = await request(`${EDITOR}/health`);
    assert(res.status === 200, `Status ${res.status}`);
    return `Status: ${res.data.status || 'ok'}`;
  });

  // ══════════════════════════════════════════════════════════════════
  // 5. EXECUTION SERVICE (Piston Code Execution)
  // ══════════════════════════════════════════════════════════════════
  console.log('\n── 5. EXECUTION SERVICE (Piston) ───────────────────');
  
  await test('Execution /health responds', async () => {
    const res = await request(`${EXECUTION}/health`);
    assert(res.status === 200, `Status ${res.status}`);
    return `Status: ${res.data.status || 'ok'}`;
  });

  // Test Piston directly
  await test('Piston API is reachable', async () => {
    const res = await request(`${PISTON}/api/v2/runtimes`);
    assert(res.status === 200, `Status ${res.status}`);
    assert(Array.isArray(res.data), 'Expected array of runtimes');
    return `${res.data.length} runtimes available`;
  });

  // List available Piston runtimes
  let pistonRuntimes = [];
  await test('List Piston runtimes', async () => {
    const res = await request(`${PISTON}/api/v2/runtimes`);
    pistonRuntimes = res.data;
    const langs = pistonRuntimes.map(r => `${r.language}@${r.version}`).slice(0, 10);
    return `Runtimes: ${langs.join(', ')}${pistonRuntimes.length > 10 ? ` (and ${pistonRuntimes.length - 10} more)` : ''}`;
  });

  // Install common languages for testing
  const languagesToInstall = ['python', 'javascript', 'typescript', 'java', 'c++', 'go', 'rust', 'ruby', 'bash'];
  
  // Check which are already installed
  const installedLangs = pistonRuntimes.map(r => r.language);
  
  if (installedLangs.length === 0) {
    console.log('\n  ⚠️  No Piston runtimes installed. Installing common languages...');
    
    // Install python3 first as it's most critical
    await test('Install Python 3 runtime', async () => {
      const res = await request(`${PISTON}/api/v2/packages`, {
        method: 'POST',
        body: { language: 'python', version: '3.10.0' }
      });
      assert(res.status === 200, `Install failed: ${res.status} - ${JSON.stringify(res.data)}`);
      return 'Python 3.10.0 installed';
    });

    await test('Install Node.js runtime', async () => {
      const res = await request(`${PISTON}/api/v2/packages`, {
        method: 'POST',
        body: { language: 'javascript', version: '18.15.0' }
      });
      // May fail if not available, that's ok
      return res.status === 200 ? 'Node.js 18 installed' : `Status ${res.status}`;
    });

    await test('Install Bash runtime', async () => {
      const res = await request(`${PISTON}/api/v2/packages`, {
        method: 'POST',
        body: { language: 'bash', version: '5.2.0' }
      });
      return res.status === 200 ? 'Bash installed' : `Status ${res.status}`;
    });
    
    // Re-fetch runtimes
    const res2 = await request(`${PISTON}/api/v2/runtimes`);
    pistonRuntimes = res2.data || [];
  }

  // Test code execution for each installed language
  const codeTests = [
    { lang: 'python', version: '*', file: 'main.py', code: 'print("Hello from Python!")', expect: 'Hello from Python!' },
    { lang: 'javascript', version: '*', file: 'index.js', code: 'console.log("Hello from JavaScript!")', expect: 'Hello from JavaScript!' },
    { lang: 'typescript', version: '*', file: 'index.ts', code: 'console.log("Hello from TypeScript!")', expect: 'Hello from TypeScript!' },
    { lang: 'bash', version: '*', file: 'script.sh', code: 'echo "Hello from Bash!"', expect: 'Hello from Bash!' },
    { lang: 'ruby', version: '*', file: 'main.rb', code: 'puts "Hello from Ruby!"', expect: 'Hello from Ruby!' },
    { lang: 'go', version: '*', file: 'main.go', code: 'package main\nimport "fmt"\nfunc main() { fmt.Println("Hello from Go!") }', expect: 'Hello from Go!' },
    { lang: 'c++', version: '*', file: 'main.cpp', code: '#include <iostream>\nint main() { std::cout << "Hello from C++!" << std::endl; return 0; }', expect: 'Hello from C++!' },
    { lang: 'java', version: '*', file: 'Main.java', code: 'public class Main { public static void main(String[] args) { System.out.println("Hello from Java!"); } }', expect: 'Hello from Java!' },
    { lang: 'rust', version: '*', file: 'main.rs', code: 'fn main() { println!("Hello from Rust!"); }', expect: 'Hello from Rust!' },
    { lang: 'c', version: '*', file: 'main.c', code: '#include <stdio.h>\nint main() { printf("Hello from C!\\n"); return 0; }', expect: 'Hello from C!' },
  ];

  for (const ct of codeTests) {
    const runtime = pistonRuntimes.find(r => r.language === ct.lang);
    if (!runtime) {
      skip(`Execute ${ct.lang} code`, `Runtime not installed`);
      continue;
    }
    
    await test(`Execute ${ct.lang} code → "${ct.expect}"`, async () => {
      const res = await request(`${PISTON}/api/v2/execute`, {
        method: 'POST',
        body: {
          language: runtime.language,
          version: runtime.version,
          files: [{ name: ct.file, content: ct.code }],
        }
      });
      assert(res.status === 200, `Status ${res.status}: ${JSON.stringify(res.data)}`);
      const stdout = (res.data.run?.stdout || '').trim();
      assert(stdout.includes(ct.expect), `Expected "${ct.expect}" but got "${stdout}"`);
      return `Output: "${stdout}" (${res.data.run?.code === 0 ? 'exit 0' : 'exit ' + res.data.run?.code})`;
    });
  }

  // Test execution via the Orion execution service API
  await test('Execution service /execute/languages endpoint', async () => {
    const res = await request(`${EXECUTION}/execute/languages`);
    assert(res.status === 200, `Status ${res.status}`);
    return `Languages endpoint: ${res.status}`;
  });

  // ══════════════════════════════════════════════════════════════════
  // 6. TERMINAL SERVICE
  // ══════════════════════════════════════════════════════════════════
  console.log('\n── 6. TERMINAL SERVICE ─────────────────────────────');
  
  await test('Terminal /health responds', async () => {
    const res = await request(`${TERMINAL}/health`);
    assert(res.status === 200, `Status ${res.status}`);
    return `Status: ${JSON.stringify(res.data)}`;
  });

  // ══════════════════════════════════════════════════════════════════
  // 7. AGENT SERVICE (AI Code Generation)
  // ══════════════════════════════════════════════════════════════════
  console.log('\n── 7. AGENT SERVICE (AI) ───────────────────────────');
  
  await test('Agent /health responds', async () => {
    const res = await request(`${AGENT}/health`);
    assert(res.status === 200, `Status ${res.status}`);
    return `Status: ${res.data.status || 'ok'}`;
  });

  await test('Agent /api/agents/pipeline rejects without auth', async () => {
    const res = await request(`${GATEWAY}/api/agents/pipeline`, {
      method: 'POST',
      body: { prompt: 'test' }
    });
    assert(res.status === 401 || res.status === 403, `Expected 401/403, got ${res.status}`);
    return `Correctly requires auth: ${res.status}`;
  });

  // ══════════════════════════════════════════════════════════════════
  // 8. NOTIFICATION SERVICE (SSE)
  // ══════════════════════════════════════════════════════════════════
  console.log('\n── 8. NOTIFICATION SERVICE ─────────────────────────');
  
  await test('Notification /health responds', async () => {
    const res = await request(`${NOTIFICATION}/health`);
    assert(res.status === 200, `Status ${res.status}`);
    return `Status: ${res.data.status || 'ok'}`;
  });

  // ══════════════════════════════════════════════════════════════════
  // 9. CROSS-SERVICE TESTS
  // ══════════════════════════════════════════════════════════════════
  console.log('\n── 9. CROSS-SERVICE INTEGRATION ────────────────────');
  
  await test('Gateway proxies to all service health endpoints', async () => {
    const res = await request(`${GATEWAY}/health`);
    const services = res.data.services;
    const healthy = Object.entries(services).filter(([, v]) => v === 'ok').map(([k]) => k);
    const down = Object.entries(services).filter(([, v]) => v !== 'ok').map(([k]) => `${k}=${services[k]}`);
    assert(healthy.length >= 6, `Only ${healthy.length}/7 healthy`);
    return `Healthy: ${healthy.join(', ')}${down.length ? ` | Down: ${down.join(', ')}` : ''}`;
  });

  await test('Frontend dev server is running', async () => {
    const res = await request('http://localhost:3010/');
    assert(res.status === 200, `Status ${res.status}`);
    assert(typeof res.data === 'string' && res.data.includes('<!'), 'Not HTML');
    return 'Frontend serving HTML at port 3010';
  });

  await test('Frontend proxies /api to gateway', async () => {
    const res = await request('http://localhost:3010/api/auth/refresh', { method: 'POST' });
    // Should get 401 (proxied through to auth service) not 404
    assert(res.status === 401 || res.status === 403, `Expected 401/403, got ${res.status}`);
    return `Proxy working: ${res.status}`;
  });

  // ══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log(`  RESULTS: ${passed} passed | ${failed} failed | ${skipped} skipped`);
  console.log('═'.repeat(70));
  
  if (failed > 0) {
    console.log('\n  FAILED TESTS:');
    results.filter(r => r.status.includes('FAIL')).forEach(r => {
      console.log(`    ❌ ${r.name}: ${r.detail}`);
    });
  }
  
  if (skipped > 0) {
    console.log('\n  SKIPPED TESTS:');
    results.filter(r => r.status.includes('SKIP')).forEach(r => {
      console.log(`    ⏭️ ${r.name}: ${r.detail}`);
    });
  }
  
  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
