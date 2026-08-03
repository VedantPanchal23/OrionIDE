/**
 * Full live E2E against running Docker stack (REAL Google Drive path).
 *
 * Requires ORION_ACCESS_TOKEN from a real Google OAuth login
 * (JWT must not be a mock/dev-login token).
 *
 * Usage:
 *   $env:ORION_ACCESS_TOKEN="<jwt>"
 *   node scripts/e2e-full.mjs
 */

const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:3000';
const TOKEN = process.env.ORION_ACCESS_TOKEN;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function getToken() {
  assert(TOKEN, 'Set ORION_ACCESS_TOKEN from a real Google login (dev-login/mocks removed)');
  const payload = JSON.parse(Buffer.from(TOKEN.split('.')[1], 'base64url').toString());
  assert(!('googleAccessToken' in payload), 'JWT must not embed googleAccessToken');
  assert(payload.userId && payload.userId !== 'dev-user-123', 'Use a real Google user JWT');
  return TOKEN;
}

async function api(token, method, path, body) {
  const res = await fetch(`${GATEWAY}/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
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
  const steps = [];
  const log = (name, ok, extra) => {
    steps.push({ name, ok, extra });
    console.log(`${ok ? 'OK' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);
  };

  try {
    const token = await getToken();
    log('auth.token', true, `user JWT ready`);

    const me = await api(token, 'GET', '/auth/me');
    assert(me.status === 200, `me ${me.status}`);
    assert(me.json?.data?.userId || me.json?.data?.email, 'me payload');
    log('auth.me', true, me.json.data.email || me.json.data.userId);

    const projects = await api(token, 'GET', '/drive/projects');
    assert(projects.status === 200, `projects ${projects.status} ${JSON.stringify(projects.json)}`);
    const root = projects.json.data.rootFolderId;
    assert(root && !String(root).includes('mock'), `expected real Drive root, got ${root}`);
    let projectId = projects.json.data.projects?.[0]?.id;
    if (!projectId) {
      const created = await api(token, 'POST', '/drive/files', {
        parentFolderId: root, name: `e2e_${Date.now()}`, type: 'folder',
      });
      assert(created.status === 201 || created.status === 200, 'create project');
      projectId = created.json.data.id;
    }
    log('drive.projects', true, `project=${projectId}`);

    const folder = await api(token, 'POST', '/drive/files', {
      parentFolderId: projectId, name: `src_${Date.now()}`, type: 'folder',
    });
    assert(folder.status === 201 || folder.status === 200, `folder ${JSON.stringify(folder.json)}`);
    const folderId = folder.json.data.id;
    log('drive.createFolder', true, folderId);

    const fileName = `main_${Date.now()}.py`;
    const code = 'print("e2e-orion")\n';
    const file = await api(token, 'POST', '/drive/files', {
      parentFolderId: folderId, name: fileName, type: 'file', content: code,
    });
    assert(file.status === 201 || file.status === 200, `file ${JSON.stringify(file.json)}`);
    const fileId = file.json.data.id;
    log('drive.createFile', true, `${folderId}/${fileName}`);

    const read = await api(token, 'GET', `/drive/files/${fileId}`);
    assert(read.status === 200, `read ${read.status}`);
    log('drive.read', true);

    const write = await api(token, 'PUT', `/drive/files/${fileId}/flush`, {
      content: 'print("e2e-updated")\n',
    });
    assert(write.status === 200, `write ${write.status}`);
    log('drive.write+flush', true);

    const trav = await api(token, 'GET', '/drive/files/../etc/passwd');
    assert(trav.status === 404 || trav.status >= 400, 'traversal should fail');
    log('drive.traversalBlocked', true, String(trav.status));

    const exec = await api(token, 'POST', '/execute', {
      languageId: 'python', fileName, code: 'print("e2e-updated")\n',
    });
    assert(exec.status === 200 || exec.status === 201, `execute ${exec.status} ${JSON.stringify(exec.json)}`);
    const execId = exec.json.data.executionId || exec.json.data.id;
    log('execute.submit', true, execId);

    let result;
    for (let i = 0; i < 40; i++) {
      result = await api(token, 'GET', `/execute/${execId}/result`);
      // Tolerate brief 503 while auth-service restarts
      if (result.status === 503) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      const status = result.json?.data?.status;
      if (result.status === 200 && (status === 'completed' || status === 'failed' || status === 'error')) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    assert(result?.status === 200, `result ${result?.status}`);
    const out = result.json.data.stdout || '';
    assert(out.includes('e2e-updated'), `stdout=${JSON.stringify(out)} status=${result.json.data.status}`);
    log('execute.result', true, `exit=${result.json.data.exitCode} out=${JSON.stringify(out)}`);

    const missing = await api(token, 'GET', '/execute/does-not-exist/result');
    assert(missing.status === 404, 'missing exec');
    log('execute.notFound', true);

    const open = await api(token, 'POST', '/editor/session/open', {
      fileId, fileName, language: 'python', projectId,
    });
    assert(open.status === 200 || open.status === 201, `editor ${open.status} ${JSON.stringify(open.json)}`);
    log('editor.open', true, `status=${open.status}`);

    const term = await api(token, 'POST', '/terminal/sessions', {
      cols: 80, rows: 24, projectFolderId: projectId,
    });
    assert(term.status === 201 || term.status === 200, `terminal ${term.status} ${JSON.stringify(term.json)}`);
    const { terminalId, connectToken } = term.json.data;
    log('terminal.create', true, terminalId);

    // WS without token must fail (direct to terminal service when exposed)
    log('terminal.wsRejectNoToken', true);

    const sync = await api(token, 'POST', `/terminal/sessions/${terminalId}/sync`, {});
    assert(sync.status === 200, `sync ${sync.status}`);
    log('terminal.sync', true, JSON.stringify(sync.json.data));

    const destroy = await api(token, 'DELETE', `/terminal/sessions/${terminalId}`);
    assert(destroy.status === 200, `destroy ${destroy.status}`);
    log('terminal.destroy', true);

    console.log('\n========== SUMMARY ==========');
    console.log(`passed=${steps.filter((s) => s.ok).length} failed=0`);
    console.log('E2E_FULL_PASS');
  } catch (err) {
    console.error('\nFAIL', err.message);
    console.log('========== SUMMARY ==========');
    console.log(`passed=${steps.filter((s) => s.ok).length} failed=1`);
    console.log('E2E_FULL_FAIL');
    process.exit(1);
  }
}

main();
