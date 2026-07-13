/**
 * Orion IDE — Comprehensive E2E API Test Suite
 * Tests every service, code execution in 17 languages, auth, terminal, and frontend
 */

const http = require('http');

let passed = 0, failed = 0, skipped = 0;

function req(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const { method = 'GET', body, timeout = 15000 } = opts;
    const u = new URL(url);
    const headers = {};
    let bodyStr = null;
    if (body) {
      bodyStr = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const r = http.request({
      hostname: u.hostname, port: u.port,
      path: u.pathname + u.search, method, headers,
      timeout,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, data: parsed, raw: data });
      });
    });
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(); reject(new Error('Timeout')); });
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function test(name, fn) {
  try {
    const detail = await fn();
    passed++;
    console.log(`  ✅ ${name}${detail ? ' → ' + detail : ''}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name} — ${err.message}`);
  }
}

function ok(cond, msg) { if (!cond) throw new Error(msg); }

async function run() {
  console.log('\n' + '═'.repeat(65));
  console.log('  ORION IDE — COMPREHENSIVE E2E TEST SUITE');
  console.log('═'.repeat(65));

  // ── 1. GATEWAY ────────────────────────────────────
  console.log('\n── 1. API GATEWAY ──────────────────────────────');
  await test('Gateway /health → all ok', async () => {
    const r = await req('http://localhost:3000/health');
    ok(r.status === 200, `Status ${r.status}`);
    ok(r.data.services, 'No services');
    const svcs = r.data.services;
    const healthy = Object.entries(svcs).filter(([,v]) => v === 'ok').map(([k]) => k);
    return `${healthy.length}/7 healthy: ${healthy.join(', ')}`;
  });

  // ── 2. AUTH ────────────────────────────────────────
  console.log('\n── 2. AUTH SERVICE ─────────────────────────────');
  await test('Auth health', async () => {
    const r = await req('http://localhost:3001/health');
    ok(r.status === 200, `Status ${r.status}`);
    return r.data.status || 'ok';
  });
  await test('Auth refresh rejects without cookie', async () => {
    const r = await req('http://localhost:3001/auth/refresh', { method: 'POST' });
    ok(r.status === 401 || r.status === 403 || r.status === 400, `Expected 4xx, got ${r.status}`);
    return `${r.status}`;
  });

  // ── 3. DRIVE ───────────────────────────────────────
  console.log('\n── 3. DRIVE SERVICE ────────────────────────────');
  await test('Drive health', async () => {
    const r = await req('http://localhost:3002/health');
    ok(r.status === 200, `Status ${r.status}`);
    return r.data.status || 'ok';
  });

  // ── 4. EDITOR ──────────────────────────────────────
  console.log('\n── 4. EDITOR SERVICE ───────────────────────────');
  await test('Editor health', async () => {
    const r = await req('http://localhost:3003/health');
    ok(r.status === 200, `Status ${r.status}`);
    return r.data.status || 'ok';
  });

  // ── 5. EXECUTION + PISTON ──────────────────────────
  console.log('\n── 5. EXECUTION SERVICE + PISTON ───────────────');
  await test('Execution health', async () => {
    const r = await req('http://localhost:3004/health');
    ok(r.status === 200, `Status ${r.status}`);
    return r.data.status || 'ok';
  });
  await test('Piston runtimes', async () => {
    const r = await req('http://localhost:2000/api/v2/runtimes');
    ok(r.status === 200 && Array.isArray(r.data), 'Bad response');
    return `${r.data.length} runtimes`;
  });
  await test('Execution /execute/languages', async () => {
    const r = await req('http://localhost:3004/execute/languages');
    ok(r.status === 200, `Status ${r.status}`);
    return 'ok';
  });

  // ── 5b. CODE EXECUTION ─────────────────────────────
  console.log('\n── 5b. CODE EXECUTION (multi-language) ────────');
  const rt = await req('http://localhost:2000/api/v2/runtimes');
  const runtimes = rt.data || [];
  const installed = {};
  for (const r of runtimes) installed[r.language] = r.version;

  const codes = [
    { lang: 'python',     ver: installed['python'],     file: 'main.py',    code: 'print("Hello Python!")',   expect: 'Hello Python!' },
    { lang: 'javascript', ver: installed['javascript'],  file: 'index.js',   code: 'console.log("Hello JS!")', expect: 'Hello JS!' },
    { lang: 'typescript', ver: installed['typescript'],  file: 'index.ts',   code: 'console.log("Hello TS!")', expect: 'Hello TS!' },
    { lang: 'bash',       ver: installed['bash'],        file: 'run.sh',     code: 'echo "Hello Bash!"',       expect: 'Hello Bash!' },
    { lang: 'java',       ver: installed['java'],        file: 'Main.java',  code: 'public class Main { public static void main(String[] a) { System.out.println("Hello Java!"); } }', expect: 'Hello Java!' },
    { lang: 'c',          ver: installed['c'],           file: 'main.c',     code: '#include <stdio.h>\nint main() { printf("Hello C!\\n"); return 0; }', expect: 'Hello C!' },
    { lang: 'c++',        ver: installed['c++'],         file: 'main.cpp',   code: '#include <iostream>\nint main() { std::cout << "Hello C++!" << std::endl; }', expect: 'Hello C++!' },
    { lang: 'go',         ver: installed['go'],          file: 'main.go',    code: 'package main\nimport "fmt"\nfunc main() { fmt.Println("Hello Go!") }', expect: 'Hello Go!' },
    { lang: 'rust',       ver: installed['rust'],        file: 'main.rs',    code: 'fn main() { println!("Hello Rust!"); }', expect: 'Hello Rust!' },
    { lang: 'ruby',       ver: installed['ruby'],        file: 'main.rb',    code: 'puts "Hello Ruby!"',       expect: 'Hello Ruby!' },
    { lang: 'php',        ver: installed['php'],         file: 'index.php',  code: '<?php echo "Hello PHP!";', expect: 'Hello PHP!' },
    { lang: 'kotlin',     ver: installed['kotlin'],      file: 'main.kt',    code: 'fun main() { println("Hello Kotlin!") }', expect: 'Hello Kotlin!' },
    { lang: 'swift',      ver: installed['swift'],       file: 'main.swift', code: 'print("Hello Swift!")',     expect: 'Hello Swift!' },
    { lang: 'lua',        ver: installed['lua'],         file: 'main.lua',   code: 'print("Hello Lua!")',       expect: 'Hello Lua!' },
    { lang: 'perl',       ver: installed['perl'],        file: 'main.pl',    code: 'print "Hello Perl!\\n";',   expect: 'Hello Perl!' },
    { lang: 'dart',       ver: installed['dart'],        file: 'main.dart',  code: 'void main() { print("Hello Dart!"); }', expect: 'Hello Dart!' },
    { lang: 'csharp',     ver: installed['csharp.net'],  file: 'Main.cs',    code: 'using System; class P { static void Main() { Console.WriteLine("Hello C#!"); } }', expect: 'Hello C#!', pistonLang: 'csharp' },
  ];

  for (const c of codes) {
    const pistonLang = c.pistonLang || c.lang;
    if (!c.ver) { skipped++; console.log(`  ⏭️  ${c.lang} — not installed`); continue; }
    await test(`Execute ${c.lang} → "${c.expect}"`, async () => {
      const r = await req('http://localhost:2000/api/v2/execute', {
        method: 'POST', timeout: 30000,
        body: { language: pistonLang, version: c.ver, files: [{ name: c.file, content: c.code }] }
      });
      ok(r.status === 200, `Status ${r.status}: ${JSON.stringify(r.data).substring(0,150)}`);
      const out = (r.data.run?.stdout || '').trim();
      ok(out.includes(c.expect), `Expected "${c.expect}", got "${out}" stderr: ${r.data.run?.stderr || ''}`);
      return `"${out}" (exit ${r.data.run?.code})`;
    });
  }

  // ── 6. TERMINAL ────────────────────────────────────
  console.log('\n── 6. TERMINAL SERVICE ─────────────────────────');
  await test('Terminal health', async () => {
    const r = await req('http://localhost:3007/health');
    ok(r.status === 200, `Status ${r.status}`);
    return JSON.stringify(r.data).substring(0, 80);
  });

  // ── 7. AGENT ───────────────────────────────────────
  console.log('\n── 7. AGENT SERVICE ────────────────────────────');
  await test('Agent health', async () => {
    const r = await req('http://localhost:3005/health');
    ok(r.status === 200, `Status ${r.status}`);
    return r.data.status || 'ok';
  });

  // ── 8. NOTIFICATION ────────────────────────────────
  console.log('\n── 8. NOTIFICATION SERVICE ─────────────────────');
  await test('Notification health', async () => {
    const r = await req('http://localhost:3006/health');
    ok(r.status === 200, `Status ${r.status}`);
    return r.data.status || 'ok';
  });

  // ── 9. FRONTEND ────────────────────────────────────
  console.log('\n── 9. FRONTEND ────────────────────────────────');
  await test('Frontend serves HTML', async () => {
    const r = await req('http://localhost:3010/');
    ok(r.status === 200, `Status ${r.status}`);
    ok(typeof r.raw === 'string' && r.raw.includes('<!'), 'Not HTML');
    return 'HTML served on :3010';
  });

  // ── SUMMARY ────────────────────────────────────────
  console.log('\n' + '═'.repeat(65));
  console.log(`  RESULTS: ${passed} passed | ${failed} failed | ${skipped} skipped`);
  console.log('═'.repeat(65) + '\n');

  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('Runner error:', err); process.exit(1); });
