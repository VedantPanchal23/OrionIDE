/**
 * Live capability smoke (no Google token required).
 * Covers: Piston, execution-service, terminal PTY, auth/drive gates, gateway health.
 *
 * Direct service calls need X-Internal-Secret (mesh auth). Load from root .env.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnv() {
  const env = {};
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = { ...loadEnv(), ...process.env };
const SECRET = env.INTERNAL_SECRET || env.DRIVE_SERVICE_SECRET || '';
const meshHeaders = {
  'Content-Type': 'application/json',
  'X-User-Id': 'live-test-user',
  ...(SECRET ? { 'X-Internal-Secret': SECRET } : {}),
};

const results = [];
const log = (n, ok, x) => {
  results.push({ n, ok });
  console.log(`${ok ? 'OK' : 'FAIL'} ${n}${x ? ` — ${x}` : ''}`);
};

async function main() {
  if (!SECRET) {
    console.error('INTERNAL_SECRET missing in .env — cannot call mesh-protected services');
    process.exit(1);
  }

  // 1) Piston
  try {
    const r = await fetch('http://localhost:2000/api/v2/runtimes');
    const j = await r.json();
    log('piston.runtimes', r.ok && Array.isArray(j), `count=${j?.length || 0}`);
  } catch (e) {
    log('piston.runtimes', false, e.message);
  }

  try {
    const r = await fetch('http://localhost:2000/api/v2/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'python',
        version: '3.10.0',
        files: [{ content: 'print(123+456)' }],
      }),
    });
    const j = await r.json();
    const out = j?.run?.stdout || '';
    log('piston.execute.python', r.ok && out.includes('579'), JSON.stringify(out).slice(0, 80));
  } catch (e) {
    log('piston.execute.python', false, e.message);
  }

  // 2) Execution service (direct, with mesh secret)
  try {
    const r = await fetch('http://localhost:3004/execute', {
      method: 'POST',
      headers: meshHeaders,
      body: JSON.stringify({ languageId: 'python', fileName: 't.py', code: 'print("exec-ok")\n' }),
    });
    const j = await r.json();
    const id = j?.data?.executionId || j?.data?.id;
    log('execution.submit', r.ok && !!id, `id=${id} status=${r.status}`);
    if (id) {
      let done = null;
      for (let i = 0; i < 25; i++) {
        const rr = await fetch(`http://localhost:3004/execute/${id}/result`, {
          headers: meshHeaders,
        });
        const jj = await rr.json();
        if (jj?.data?.status === 'completed' || jj?.data?.status === 'failed') {
          done = jj.data;
          break;
        }
        await new Promise((res) => setTimeout(res, 300));
      }
      log(
        'execution.result',
        !!done && String(done.stdout).includes('exec-ok'),
        done ? `exit=${done.exitCode} out=${JSON.stringify(done.stdout)}` : 'timeout'
      );
    }
  } catch (e) {
    log('execution', false, e.message);
  }

  // 3) Terminal create + WS echo command
  try {
    const r = await fetch('http://localhost:3007/terminal/sessions', {
      method: 'POST',
      headers: meshHeaders,
      body: JSON.stringify({ cols: 80, rows: 24 }),
    });
    const j = await r.json();
    const tid = j?.data?.terminalId;
    const tok = j?.data?.connectToken;
    const cwd = j?.data?.cwd;
    log('terminal.create', r.status === 201 && tid && tok, `cwd=${cwd}`);

    if (tid && tok) {
      await new Promise((resolve) => {
        const ws = new WebSocket(
          `ws://localhost:3007/terminal/ws/terminal?terminalId=${tid}&token=${encodeURIComponent(tok)}`
        );
        let got = false;
        let buf = '';
        const timer = setTimeout(() => {
          try { ws.close(); } catch { /* */ }
          log('terminal.echo', got, `partial=${JSON.stringify(buf).slice(0, 120)}`);
          resolve();
        }, 5000);

        ws.addEventListener('open', () => {
          log('terminal.ws.open', true);
          ws.send(JSON.stringify({ type: 'input', data: 'echo ORION_TERM_OK\n' }));
        });
        ws.addEventListener('message', (e) => {
          buf += String(e.data);
          if (buf.includes('ORION_TERM_OK')) {
            got = true;
            clearTimeout(timer);
            ws.close();
            log('terminal.echo', true);
            resolve();
          }
        });
        ws.addEventListener('error', () => {
          clearTimeout(timer);
          log('terminal.ws.error', false);
          resolve();
        });
      });

      await new Promise((resolve) => {
        const ws = new WebSocket(`ws://localhost:3007/terminal/ws/terminal?terminalId=${tid}`);
        const timer = setTimeout(() => {
          log('terminal.wsRejectNoToken', false, 'did not close');
          try { ws.close(); } catch { /* */ }
          resolve();
        }, 2000);
        ws.addEventListener('close', (ev) => {
          clearTimeout(timer);
          log('terminal.wsRejectNoToken', ev.code === 1008 || ev.code !== 1000, `code=${ev.code}`);
          resolve();
        });
        ws.addEventListener('error', () => {
          clearTimeout(timer);
          log('terminal.wsRejectNoToken', true, 'error-as-reject');
          resolve();
        });
      });

      const d = await fetch(`http://localhost:3007/terminal/sessions/${tid}`, {
        method: 'DELETE',
        headers: meshHeaders,
      });
      log('terminal.destroy', d.ok, `status=${d.status}`);
    }
  } catch (e) {
    log('terminal', false, e.message);
  }

  // 4) Gates
  try {
    const r = await fetch('http://localhost:3001/auth/dev-login', { redirect: 'manual' });
    log('auth.dev-login.removed', r.status === 404, `status=${r.status}`);
  } catch (e) {
    log('auth.dev-login.removed', false, e.message);
  }

  try {
    const r = await fetch('http://localhost:3002/drive/projects');
    log('drive.noAuth.rejected', r.status === 401 || r.status === 403, `status=${r.status}`);
  } catch (e) {
    log('drive.noAuth', false, e.message);
  }

  try {
    const r = await fetch('http://localhost:3000/health');
    const j = await r.json();
    log('gateway.health', r.ok, JSON.stringify(j.status || j).slice(0, 120));
  } catch (e) {
    log('gateway.health', false, e.message);
  }

  const pass = results.filter((x) => x.ok).length;
  const fail = results.filter((x) => !x.ok).length;
  console.log(`\nSUMMARY pass=${pass} fail=${fail}`);
  if (fail) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
