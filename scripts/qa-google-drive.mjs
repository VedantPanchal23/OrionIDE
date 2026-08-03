/**
 * Real Google Drive QA — production path (not mock-token).
 *
 * Prerequisites:
 *   1. Stack running (docker-compose.dev.yml)
 *   2. Valid Google OAuth credentials in .env
 *   3. A real access JWT obtained via browser Google login
 *      (dev-login uses mock Drive and will FAIL this script by design)
 *
 * Usage:
 *   set ORION_ACCESS_TOKEN=<jwt from browser after Google login>
 *   node scripts/qa-google-drive.mjs
 *
 * Optional:
 *   GATEWAY_URL=http://localhost:3000
 */

const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:3000';
const TOKEN = process.env.ORION_ACCESS_TOKEN;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function api(method, path, body) {
  const res = await fetch(`${GATEWAY}/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function main() {
  if (!TOKEN) {
    console.error(`
QA_GOOGLE_DRIVE — missing ORION_ACCESS_TOKEN

This script validates the REAL Google Drive path (production SaaS).
1. Open http://localhost:3010/login
2. Continue with Google (not Developer Mode)
3. From DevTools → Application/Network, copy the access JWT
4. ORION_ACCESS_TOKEN=<jwt> node scripts/qa-google-drive.mjs
`);
    process.exit(2);
  }

  // Decode JWT payload (no verify) — reject mock / slim-check google secret absence
  const payload = JSON.parse(Buffer.from(TOKEN.split('.')[1], 'base64url').toString());
  assert(!('googleAccessToken' in payload), 'JWT must not embed googleAccessToken (production auth)');
  assert(payload.userId && payload.userId !== 'dev-user-123', 'Use a real Google user JWT, not dev-login');

  const steps = [];
  const log = (name, ok, extra) => {
    steps.push({ name, ok, extra });
    console.log(`${ok ? 'OK' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);
  };

  try {
    const me = await api('GET', '/auth/me');
    assert(me.status === 200, `me ${me.status}`);
    assert(me.json?.data?.email, 'email required');
    log('auth.me', true, me.json.data.email);

    const projects = await api('GET', '/drive/projects');
    assert(projects.status === 200, `projects ${projects.status} ${JSON.stringify(projects.json)}`);
    const root = projects.json.data.rootFolderId;
    assert(root && !String(root).startsWith('mock'), `expected real Drive root, got ${root}`);
    log('drive.projects', true, `root=${root} count=${projects.json.data.projects?.length ?? 0}`);

    const name = `qa_orion_${Date.now()}.txt`;
    const created = await api('POST', '/drive/files', {
      parentFolderId: root,
      name,
      type: 'file',
      content: 'orion-google-drive-qa\n',
    });
    assert(created.status === 200 || created.status === 201, `create ${JSON.stringify(created.json)}`);
    const fileId = created.json.data.id;
    assert(fileId && !String(fileId).includes('mock'), `expected real file id, got ${fileId}`);
    log('drive.createFile', true, fileId);

    const read = await api('GET', `/drive/files/${fileId}`);
    assert(read.status === 200, `read ${read.status} ${JSON.stringify(read.json)}`);
    const content = read.json?.data?.content ?? read.json?.data;
    assert(String(content).includes('orion-google-drive-qa'), 'content mismatch');
    log('drive.read', true);

    const write = await api('PUT', `/drive/files/${fileId}/flush`, {
      content: 'orion-google-drive-qa-updated\n',
    });
    assert(write.status === 200, `write ${write.status}`);
    log('drive.write', true);

    // Cleanup — production hygiene
    const del = await api('DELETE', `/drive/files/${fileId}`);
    assert(del.status === 200 || del.status === 204, `delete ${del.status}`);
    log('drive.delete', true);

    console.log('\n========== SUMMARY ==========');
    console.log(`passed=${steps.filter((s) => s.ok).length} failed=0`);
    console.log('QA_GOOGLE_DRIVE_PASS');
  } catch (err) {
    console.error('\nFAIL', err.message);
    console.log('========== SUMMARY ==========');
    console.log(`passed=${steps.filter((s) => s.ok).length} failed=1`);
    console.log('QA_GOOGLE_DRIVE_FAIL');
    process.exit(1);
  }
}

main();
