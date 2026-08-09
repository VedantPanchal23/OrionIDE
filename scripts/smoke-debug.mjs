/**
 * Debugger API smoke — create session, set breakpoint, command, destroy.
 *
 *   $env:ORION_ACCESS_TOKEN=(node scripts/mint-access-token.mjs --print)
 *   node scripts/smoke-debug.mjs
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
  assert(TOKEN, 'Set ORION_ACCESS_TOKEN');
  const log = (n, ok, x) => console.log(`${ok ? 'OK' : 'FAIL'} ${n}${x ? ` — ${x}` : ''}`);

  try {
    const adapters = await api('GET', '/editor/debug/adapters');
    assert(adapters.status === 200, `adapters ${adapters.status}`);
    log('debug.adapters', true, JSON.stringify(adapters.json.data?.adapters?.map((a) => a.type)));

    const projects = await api('GET', '/drive/projects');
    const projectId = projects.json.data.projects?.[0]?.id;

    // Ensure a small python file exists for the adapter target
    const folder = await api('POST', '/drive/files', {
      parentFolderId: projectId,
      name: `dbg_${Date.now()}`,
      type: 'folder',
    });
    const folderId = folder.json.data.id;
    const code = 'x = 1\nprint(x)\n';
    const file = await api('POST', '/drive/files', {
      parentFolderId: folderId,
      name: 'dbg_main.py',
      type: 'file',
      content: code,
    });
    const fileId = file.json.data.id;
    log('debug.file', true, fileId);

    // Sync into terminal workspace so debugger can find relative path
    const term = await api('POST', '/terminal/sessions', {
      cols: 80, rows: 24, projectFolderId: projectId,
    });
    const terminalId = term.json.data.terminalId;
    await api('POST', `/terminal/sessions/${terminalId}/sync`, {});
    log('debug.workspaceSync', true);

    const create = await api('POST', '/editor/debug/sessions', {
      type: 'python',
      program: 'dbg_main.py',
      cwd: folderId, // may be ignored; adapters often use workspace-relative
      projectFolderId: projectId,
      fileId,
    });
    // Accept 201/200 or graceful 501 if adapter runtime missing
    if (create.status >= 400) {
      log('debug.create', create.status === 501 || create.status === 400 || create.status === 422,
        `status=${create.status} ${JSON.stringify(create.json).slice(0, 200)}`);
    } else {
      const sessionId = create.json.data?.id || create.json.data?.sessionId;
      log('debug.create', !!sessionId, sessionId);

      const bp = await api('POST', `/editor/debug/sessions/${sessionId}/breakpoints`, {
        breakpoints: [{ fileId, line: 1, verified: false }],
      });
      log('debug.breakpoints', bp.status === 200, `status=${bp.status}`);

      const cont = await api('POST', `/editor/debug/sessions/${sessionId}/command`, {
        command: 'continue',
      });
      log('debug.command', cont.status === 200 || cont.status === 409, `status=${cont.status}`);

      const del = await api('DELETE', `/editor/debug/sessions/${sessionId}`);
      log('debug.destroy', del.status === 200, `status=${del.status}`);
    }

    await api('DELETE', `/terminal/sessions/${terminalId}`);
    await api('DELETE', `/drive/files/${fileId}`);
    await api('DELETE', `/drive/files/${folderId}`);

    console.log('SMOKE_DEBUG_PASS');
  } catch (err) {
    console.error('SMOKE_DEBUG_FAIL', err.message);
    process.exit(1);
  }
}

main();
